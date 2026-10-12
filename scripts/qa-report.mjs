import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const QA_DIR = path.join(ROOT, '.qa');
const REPORT = path.join(ROOT, 'qa-report.md');

fs.mkdirSync(QA_DIR, { recursive: true });

const stages = [
  {
    id: 'unit',
    name: 'Tests unitarios',
    command: 'npm',
    args: ['run', 'test'],
  },
  {
    id: 'build',
    name: 'Build de producción',
    command: 'npm',
    args: ['run', 'build'],
  },
  {
    id: 'e2e',
    name: 'Playwright E2E',
    command: 'npx',
    args: ['playwright', 'test'],
  },
];

const results = [];

function cleanAnsi(text) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

function runStage(stage) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${stage.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const started = Date.now();

  const result = spawnSync(stage.command, stage.args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
    },
    maxBuffer: 1024 * 1024 * 100,
  });

  const stdout = cleanAnsi(result.stdout || '');
  const stderr = cleanAnsi(result.stderr || '');
  const combined = `${stdout}${stderr ? `\n${stderr}` : ''}`.trim();

  fs.writeFileSync(
    path.join(QA_DIR, `${stage.id}.log`),
    combined + '\n'
  );

  const duration = ((Date.now() - started) / 1000).toFixed(1);

  const data = {
    ...stage,
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status ?? 1,
    duration,
    output: combined,
  };

  results.push(data);

  if (result.status === 0) {
    console.log(`✅ ${stage.name}: PASS (${duration}s)`);
  } else {
    console.log(`❌ ${stage.name}: FAIL (${duration}s)`);
  }
}

function extractUnitSummary(output) {
  const tests =
    output.match(/Tests\s+(\d+)\s+passed(?:\s+\((\d+)\))?/) ||
    output.match(/(\d+)\s+passed/);

  const files =
    output.match(/Test Files\s+(\d+)\s+passed(?:\s+\((\d+)\))?/);

  const parts = [];

  if (tests) parts.push(`${tests[1]} tests`);
  if (files) parts.push(`${files[1]} archivos`);

  return parts.length ? parts.join(', ') : 'completado';
}

function extractE2ESummary(output) {
  const passed = output.match(/(\d+)\s+passed/);
  const failed = output.match(/(\d+)\s+failed/);

  const parts = [];

  if (passed) parts.push(`${passed[1]} passed`);
  if (failed) parts.push(`${failed[1]} failed`);

  return parts.length ? parts.join(', ') : 'completado';
}

function extractBuildSummary(output) {
  const match = output.match(/✓ built in ([^\n]+)/);
  return match ? `build en ${match[1].trim()}` : 'build completado';
}

function warningsFrom(output) {
  const warnings = [];

  if (output.includes('not wrapped in act')) {
    warnings.push('React tests: avisos `act(...)`.');
  }

  if (output.includes('HTMLCanvasElement.prototype.getContext')) {
    warnings.push('jsdom/axe: `HTMLCanvasElement.getContext` no implementado.');
  }

  if (output.includes('React Router Future Flag Warning')) {
    warnings.push('React Router: Future Flag Warning para v7.');
  }

  if (output.includes('Some chunks are larger than 500 kB')) {
    warnings.push('Vite: existe al menos un chunk superior a 500 kB.');
  }

  if (output.includes('Supabase env vars missing')) {
    warnings.push('Generación local del sitemap sin variables Supabase.');
  }

  return warnings;
}

function failureExcerpt(output) {
  const lines = output.split('\n');

  const interesting = lines.filter(line =>
    /FAIL|failed|Error:|Timeout|Expected:|Received:|broken|rotas|invalid|403|500/i.test(line)
  );

  if (interesting.length) {
    return interesting.slice(-40).join('\n');
  }

  return lines.slice(-60).join('\n');
}

for (const stage of stages) {
  runStage(stage);
}

const allPassed = results.every(r => r.status === 'PASS');

const unit = results.find(r => r.id === 'unit');
const build = results.find(r => r.id === 'build');
const e2e = results.find(r => r.id === 'e2e');

const warningSet = new Set();

for (const result of results) {
  for (const warning of warningsFrom(result.output)) {
    warningSet.add(warning);
  }
}

let markdown = `# Málaga Connect — QA Report

Generado: ${new Date().toLocaleString('es-ES')}

## Estado

**${allPassed ? '✅ PASS — QA completo correcto' : '❌ FAIL — existen errores que revisar'}**

| Etapa | Estado | Resumen | Tiempo |
|---|---|---|---:|
| Tests unitarios | ${unit.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${extractUnitSummary(unit.output)} | ${unit.duration}s |
| Build | ${build.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${extractBuildSummary(build.output)} | ${build.duration}s |
| Playwright E2E | ${e2e.status === 'PASS' ? '✅ PASS' : '❌ FAIL'} | ${extractE2ESummary(e2e.output)} | ${e2e.duration}s |

## Cobertura E2E actual

Playwright comprueba actualmente:

- carga de rutas principales;
- errores graves de consola;
- navegación principal mediante BottomNav;
- imágenes rotas;
- enlaces HTML inválidos;
- overflow horizontal;
- comportamiento en desktop;
- comportamiento en iPhone;
- comportamiento en iPad.

## Warnings conocidos
`;

if (warningSet.size) {
  for (const warning of warningSet) {
    markdown += `\n- ${warning}`;
  }
} else {
  markdown += `\n- Ninguno detectado.`;
}

const failures = results.filter(r => r.status === 'FAIL');

markdown += `\n\n## Errores reales\n`;

if (!failures.length) {
  markdown += `\nNo se han detectado errores bloqueantes.\n`;
} else {
  for (const failure of failures) {
    markdown += `\n### ${failure.name}\n\n`;
    markdown += '```text\n';
    markdown += failureExcerpt(failure.output);
    markdown += '\n```\n';
  }
}

markdown += `

## Logs completos

- \`.qa/unit.log\`
- \`.qa/build.log\`
- \`.qa/e2e.log\`

## Prompt para Codex

`;

if (allPassed) {
  markdown += `\`\`\`text
El QA completo de Málaga Connect está en verde.

No hagas cambios simplemente por hacerlos.

Revisa qa-report.md y los logs de .qa/ únicamente si necesitas contexto.
Si vas a modificar código, conserva el comportamiento existente y ejecuta npm run qa antes de considerar terminado el trabajo.
\`\`\`
`;
} else {
  markdown += `\`\`\`text
Analiza qa-report.md y reproduce únicamente los fallos reales indicados.

Consulta los logs completos dentro de .qa/ cuando necesites más contexto.

Corrige la causa raíz con el cambio mínimo necesario.
No cambies tests para ocultar un bug real.
No modifiques funcionalidad no relacionada.
Después de cada corrección ejecuta npm run qa.

El trabajo solo puede considerarse terminado cuando npm run qa quede completamente en verde.
\`\`\`
`;
}

fs.writeFileSync(REPORT, markdown);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (allPassed) {
  console.log('✅ QA COMPLETO: PASS');
} else {
  console.log('❌ QA COMPLETO: FAIL');
}

console.log(`📄 Informe: ${REPORT}`);
console.log(`📁 Logs:    ${QA_DIR}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(allPassed ? 0 : 1);
