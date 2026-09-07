"""Read-only audit of the supplied URL inventory; never runs an ingestion job."""
import csv
import hashlib
import ipaddress
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import requests

ROOT = Path(__file__).parent
AGENT = 'MalagaConnectAudit/1.0'
LIMIT = 512 * 1024
locks, robots_cache = {}, {}
mutex = threading.Lock()


def normalize(raw):
    value = raw.strip().rstrip('`\"\'').replace('&amp;', '&')
    p = urlsplit(value)
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), p.path.rstrip('/') or '/', p.query, ''))


def safe_public_url(url):
    p = urlsplit(url)
    if p.scheme not in ('https', 'http') or not p.hostname or p.username or p.password:
        return False
    if p.port not in (None, 80, 443):
        return False
    host = p.hostname.lower()
    if host == 'localhost' or '.' not in host or host.endswith(('.local', '.internal', '.localhost')):
        return False
    try:
        if not ipaddress.ip_address(host).is_global:
            return False
    except ValueError:
        pass
    return True


def request_page(url):
    """Bound redirects, size and duration; no login, cookies or paid API calls."""
    current = url
    for _ in range(6):
        if not safe_public_url(current):
            return {'http': '', 'final_url': current, 'note': 'destino no público o no permitido', 'error': 'unsafe_url'}
        started = time.monotonic()
        try:
            with requests.get(current, headers={'User-Agent': AGENT, 'Accept': 'text/html,text/plain,text/calendar,application/json,text/csv,*/*;q=0.5'},
                              timeout=(5, 10), allow_redirects=False, stream=True) as response:
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get('Location')
                    if not location:
                        return {'http': response.status_code, 'final_url': current, 'error': 'redirect_without_location'}
                    current = urljoin(current, location)
                    continue
                chunks, size, truncated = [], 0, False
                for chunk in response.iter_content(16384):
                    size += len(chunk)
                    chunks.append(chunk)
                    if size > LIMIT or time.monotonic() - started > 20:
                        truncated = True
                        break
                body = b''.join(chunks)[:LIMIT]
                return {'http': response.status_code, 'final_url': current,
                        'content_type': response.headers.get('Content-Type', ''),
                        'body': body.decode(response.encoding or 'utf-8', errors='replace'),
                        'bytes': len(body), 'truncated': truncated}
        except requests.exceptions.SSLError:
            return {'http': '', 'final_url': current, 'error': 'tls_error', 'note': 'certificado no validable; no se desactiva TLS'}
        except requests.exceptions.Timeout:
            return {'http': '', 'final_url': current, 'error': 'timeout'}
        except requests.exceptions.RequestException:
            return {'http': '', 'final_url': current, 'error': 'connection_error'}
    return {'http': '', 'final_url': current, 'error': 'redirect_limit'}


def check_robots(url):
    p = urlsplit(url)
    origin = f'{p.scheme}://{p.netloc}'
    if origin not in robots_cache:
        result = request_page(origin + '/robots.txt')
        status = result.get('http')
        if status == 404:
            robots_cache[origin] = ('sin robots.txt (404)', None)
        elif status == 200:
            body = result.get('body', '')
            if result.get('truncated') or ('<html' in body.lower() and not re.search(r'(?im)^user-agent\s*:', body)):
                robots_cache[origin] = ('no verificable', None)
            else:
                parser = RobotFileParser()
                parser.parse(body.splitlines())
                robots_cache[origin] = ('analizado', parser)
        else:
            robots_cache[origin] = (f'no verificable ({status or result.get("error", "error")})', None)
    status, parser = robots_cache[origin]
    if status.startswith('no verificable'):
        return status, False
    if parser is not None and not parser.can_fetch(AGENT, url):
        return 'prohibido', False
    return 'permitido' if parser else status, True


def classify(url):
    p = urlsplit(url)
    if any(part in url for part in ('...', '${', '<', '>', '{', '}')):
        return 'plantilla o ejemplo incompleto'
    if p.hostname in ('api.firecrawl.dev', 'ai.gateway.lovable.dev'):
        return 'servicio de API, no fuente de agenda'
    if p.hostname and p.hostname.startswith(('docs.', 'developer.', 'developers.')):
        return 'documentación'
    if re.search(r'\.(?:png|jpe?g|webp|gif|svg)(?:\?|$)', url, re.I):
        return 'imagen'
    if p.hostname and ('instagram.com' in p.hostname or 'facebook.com' in p.hostname):
        return 'red social'
    if p.hostname == 'malagaevents.lovable.app':
        return 'aplicación propia'
    return 'fuente o página informativa'


def inspect(url):
    kind = classify(url)
    row = {'normalized_url': url, 'kind': kind, 'checked_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'verification': 'comprobación independiente de URL; extractor no ejecutado'}
    if kind in ('plantilla o ejemplo incompleto', 'servicio de API, no fuente de agenda') or not safe_public_url(url):
        return {**row, 'result': 'no procede solicitar como agenda', 'note': kind}
    host = urlsplit(url).netloc.lower()
    with mutex:
        lock = locks.setdefault(host, threading.Lock())
    with lock:
        robots, allowed = check_robots(url)
        row['robots'] = robots
        if not allowed:
            return {**row, 'result': 'excluida por robots' if robots == 'prohibido' else 'robots no verificable; contenido no solicitado'}
        response = request_page(url)
        body = response.pop('body', '')
        row.update(response)
        row['result'] = response.get('error') or f'HTTP {response.get("http", "desconocido")}'
        title = re.search(r'<title[^>]*>(.*?)</title>', body, re.S | re.I)
        title_text = re.sub(r'\s+', ' ', title.group(1)).strip() if title else ''
        if response.get('http') == 200 and re.search(r'just a moment|checking your browser|access denied|verifica.{0,30}(humano|human)', title_text, re.I):
            row['result'] = '200 con pantalla de verificación; no válido como agenda'
        signals = []
        if 'BEGIN:VCALENDAR' in body:
            signals.append('ICS')
        if re.search(r'"@type"\s*:\s*"(?:Event|SportsEvent|MusicEvent)"', body):
            signals.append('Event JSON-LD')
        if re.search(r'<(?:rss|feed)[\s>]', body, re.I):
            signals.append('RSS/Atom')
        row['signals'] = '; '.join(signals)
        if response.get('truncated'):
            row['note'] = 'cuerpo limitado; no acredita contenido completo'
        return row


def main():
    evidence = json.loads((ROOT / 'evidencia-fuentes-malaga-connect.json').read_text())
    inventory = {}
    crosswalk = []
    for raw in evidence['historical_unique_urls']:
        url = normalize(raw)
        inventory.setdefault(url, set()).add('historial del usuario')
        mentions = [m for m in evidence['historical_mentions'] if m['url'] == raw]
        crosswalk.append({'original_url': raw, 'normalized_url': url, 'mentions': len(mentions),
                          'message_ids': '; '.join(dict.fromkeys(m['message_id'] for m in mentions))})
    for source in evidence['source_registries']:
        for field in ('url', 'primary_url', 'chosen_entrypoint', 'fallback_entrypoint', 'entrypoints_detected', 'secondary_urls'):
            values = source.get(field) or []
            for raw in values if isinstance(values, list) else [values]:
                if isinstance(raw, str) and raw.startswith(('https://', 'http://')):
                    inventory.setdefault(normalize(raw), set()).add(f'{source["registry"]}:{source.get("slug") or source.get("name")}:{field}')
    prior = {}
    with open('/tmp/malaga-registered-sources.csv') as file:
        for row in csv.DictReader(file):
            url = normalize(row['url'])
            prior[url] = {'normalized_url': url, 'kind': classify(url), 'http': row['estado_http'],
                          'robots': row['robots'], 'signals': row['senal_agenda'], 'note': row['nota'],
                          'checked_at': row['comprobado'], 'result': 'URL comprobada por Lovable',
                          'verification': 'resultado reutilizado de la comprobación de Lovable; extractor no acreditado por HTTP'}
            if url not in inventory:
                inventory[url] = {'auditoría Lovable:URL adicional descubierta'}
    rows = [dict(prior[url], origins='; '.join(sorted(origins))) for url, origins in inventory.items() if url in prior]
    missing = sorted(set(inventory) - set(prior))
    output = ROOT / 'fuentes-auditadas-malaga-connect.json'
    if '--resume' in sys.argv and output.exists():
        previous = {row['normalized_url']: row for row in json.loads(output.read_text())}
        resumed = [url for url in missing if url in previous]
        rows.extend(dict(previous[url], origins='; '.join(sorted(inventory[url]))) for url in resumed)
        missing = [url for url in missing if url not in previous]
    print(f'Inventario {len(inventory)}; reutilizadas {len(rows)}; pendientes {len(missing)}', flush=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(inspect, url): url for url in missing}
        for count, future in enumerate(as_completed(futures), 1):
            url = futures[future]
            try:
                row = future.result()
            except Exception as exc:
                row = {'normalized_url': url, 'result': 'error de auditoría', 'note': type(exc).__name__}
            rows.append(dict(row, origins='; '.join(sorted(inventory[url]))))
            output.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
            if count % 10 == 0 or count == len(missing):
                print(f'Completadas {count}/{len(missing)} URL adicionales', flush=True)
    rows.sort(key=lambda row: row['normalized_url'])
    output.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    fields = ['normalized_url', 'origins', 'kind', 'checked_at', 'http', 'final_url', 'robots', 'result', 'signals', 'content_type', 'bytes', 'truncated', 'note', 'verification', 'error']
    with (ROOT / 'fuentes-auditadas-malaga-connect.csv').open('w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    with (ROOT / 'trazabilidad-270-url-malaga-connect.csv').open('w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['original_url', 'normalized_url', 'mentions', 'message_ids'])
        writer.writeheader(); writer.writerows(crosswalk)
    independent = sum(row.get('verification', '').startswith('comprobación independiente') for row in rows)
    summary = {'normalized_urls': len(rows), 'raw_historical_urls': len(crosswalk), 'independently_checked_additional': independent, 'lovable_reused': len(rows)-independent}
    (ROOT / 'resumen-fuentes-malaga-connect.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary), flush=True)


if __name__ == '__main__':
    main()
