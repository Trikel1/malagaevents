import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import {
  Phone, MapPin, Calendar as CalendarIcon, AlertTriangle,
  Search, ChevronDown, Check, Navigation, X, Pill, LocateFixed, Info,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import SEO from '@/components/common/SEO';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import { usePharmaciesOnDuty, usePharmacyDirectory, usePharmacyGuardSyncStatus } from '@/hooks/usePharmacies';
import { LOCALITIES_CATALOG, ZONE_LABELS, ZONE_ORDER, type ZoneKey } from '@/lib/localitiesCatalog';
import { haversineKm, formatDistance } from '@/lib/distance';
import { findDirectoryMatch, parseAddress } from '@/lib/pharmacyAddressMatch';
import { normalizeMunicipalityKey } from '@/lib/pharmacyMunicipality';
import { cn } from '@/lib/utils';


const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru,
};

const TIMEZONE = 'Europe/Madrid';
const DEFAULT_MUNICIPALITY = 'Málaga';
const ALL_PROVINCE_LABEL = 'Toda la provincia';

// Returns "now" anchored to Europe/Madrid (so the day picker reflects Madrid's calendar day).
const madridNow = () => toZonedTime(new Date(), TIMEZONE);

// Curated list grouped by zone — mirrors the Events location filter pattern.
type LocalityGroup = { zone: ZoneKey; label: string; entries: { name: string; slug: string }[] };

const PHARMACY_LOCALITY_GROUPS: LocalityGroup[] = (() => {
  const byZone = new Map<ZoneKey, { name: string; slug: string }[]>();
  for (const e of LOCALITIES_CATALOG) {
    const arr = byZone.get(e.zone) ?? [];
    arr.push({ name: e.name, slug: e.slug });
    byZone.set(e.zone, arr);
  }
  for (const [, arr] of byZone) arr.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return ZONE_ORDER
    .map((z) => ({ zone: z, label: ZONE_LABELS[z], entries: byZone.get(z) ?? [] }))
    .filter((g) => g.entries.length > 0);
})();

const ALL_PHARMACY_LOCALITIES: string[] = PHARMACY_LOCALITY_GROUPS.flatMap((g) =>
  g.entries.map((e) => e.name)
);


const stripDiacritics = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Internal map route — pharmacies are located inside the app map. */
const getMapsUrl = (p: { lat?: number | null; lng?: number | null; address: string; municipality?: string }) => {
  const params = new URLSearchParams({ kind: 'pharmacy' });
  if (p.lat && p.lng) {
    params.set('lat', String(p.lat));
    params.set('lng', String(p.lng));
  } else {
    params.set('q', `${p.address}, ${p.municipality ?? 'Málaga'}`);
  }
  return `/map?${params.toString()}`;
};

const formatPhoneForLink = (phone: string) => phone.replace(/[^\d+]/g, '');

interface PharmacyCardProps {
  pharmacy: {
    name: string; address: string; phone?: string | null;
    lat?: number | null; lng?: number | null; municipality?: string;
  };
  onDuty?: boolean;
  distanceKm?: number | null;
  /**
   * 'verified'    — the source published this rota for the selected date.
   * 'unconfirmed' — rota published for the previous day, shown during the
   *                 early-morning gap before the source publishes today.
   */
  dutyState?: 'verified' | 'unconfirmed';
  /** Human date the rota was published for, e.g. "domingo, 7 de septiembre". */
  dutyDateLabel?: string;
  /** Official page the row was read from. */
  sourceRef?: string | null;
  /** True when phone/coordinates were taken from the official directory. */
  contactFromDirectory?: boolean;
}

const PharmacyCard = ({
  pharmacy, onDuty = false, distanceKm,
  dutyState = 'verified', dutyDateLabel, sourceRef, contactFromDirectory,
}: PharmacyCardProps) => {
  const { t } = useTranslation();
  const unconfirmed = onDuty && dutyState === 'unconfirmed';
  const hasCoords = pharmacy.lat != null && pharmacy.lng != null;

  return (
    <Card className={cn(
      'overflow-hidden rounded-2xl border-border/60 transition',
      onDuty && !unconfirmed && 'border-emerald-500/50 ring-1 ring-emerald-500/15',
      unconfirmed && 'border-amber-500/60 ring-1 ring-amber-500/15'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 shrink-0">
              <Pill className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight">{pharmacy.name}</h3>
              {pharmacy.municipality && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{pharmacy.municipality}</p>
              )}
            </div>
          </div>
          {onDuty && (
            unconfirmed ? (
              <Badge className="shrink-0 text-white bg-amber-600 hover:bg-amber-600 gap-1">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {t('pharmacies.guardUnconfirmed', 'Guardia sin confirmar')}
              </Badge>
            ) : (
              <Badge className="shrink-0 text-white bg-emerald-600 hover:bg-emerald-600 gap-1">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {t('pharmacies.verifiedGuard', 'Guardia verificada')}
              </Badge>
            )
          )}
        </div>

        {onDuty && dutyDateLabel && (
          <p className={cn('text-[12px] mt-1', unconfirmed ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
            {unconfirmed
              ? t('pharmacies.guardPublishedForPrev', {
                  defaultValue: 'Turno publicado para {{date}}. Puede seguir vigente de madrugada: confirma por teléfono antes de ir.',
                  date: dutyDateLabel,
                })
              : t('pharmacies.guardPublishedFor', {
                  defaultValue: 'Guardia publicada para {{date}}',
                  date: dutyDateLabel,
                })}
          </p>
        )}

        {typeof distanceKm === 'number' && (
          <div className="text-[11px] text-primary font-medium mt-1 flex items-center gap-1">
            <Navigation className="h-3 w-3" aria-hidden="true" />
            {formatDistance(distanceKm)} {t('pharmacies.distanceAway', 'de distancia')}
          </div>
        )}

        <div className="text-sm text-foreground/85 mt-2 flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>{pharmacy.address}</span>
        </div>

        {pharmacy.phone && (
          <div className="text-sm text-foreground/85 mt-1.5 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{pharmacy.phone}</span>
          </div>
        )}

        {onDuty && contactFromDirectory && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {t('pharmacies.contactFromDirectory', 'Nombre, teléfono y ubicación tomados del directorio oficial (coincidencia por dirección).')}
          </p>
        )}

        <div className="mt-3 flex flex-col min-[360px]:flex-row gap-2">
          {pharmacy.phone ? (
            <Button asChild size="sm" className="flex-1 min-w-0 h-11">
              <a href={`tel:${formatPhoneForLink(pharmacy.phone)}`}>
                <Phone className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('pharmacies.call', 'Llamar')}</span>
              </a>
            </Button>
          ) : (
            <p className="flex-1 text-[11px] text-muted-foreground self-center">
              {t('pharmacies.noPhoneKnown', 'No tenemos teléfono verificado de esta farmacia.')}
            </p>
          )}
          {pharmacy.address && (
            <Button asChild size="sm" variant="outline" className="flex-1 min-w-0 h-11">
              <Link to={getMapsUrl(pharmacy)}>
                <Navigation className="h-4 w-4 mr-1.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{t('pharmacies.directions', 'Cómo llegar')}</span>
              </Link>
            </Button>
          )}
        </div>

        {pharmacy.address && !hasCoords && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {t('pharmacies.approxLocation', 'Ubicación aproximada: solo conocemos la dirección publicada, no sus coordenadas exactas.')}
          </p>
        )}

        {sourceRef && (
          <a
            href={sourceRef}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary underline underline-offset-2 mt-2 inline-block"
          >
            {t('pharmacies.viewSource', 'Ver la fuente oficial')}
          </a>
        )}
      </CardContent>
    </Card>
  );
};

interface LocalitySelectorProps {
  value: string;
  onChange: (v: string) => void;
}

const LocalitySelector = ({ value, onChange }: LocalitySelectorProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filteredGroups = useMemo(() => {
    const nq = stripDiacritics(q.trim());
    if (!nq) return PHARMACY_LOCALITY_GROUPS;
    return PHARMACY_LOCALITY_GROUPS
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => stripDiacritics(e.name).includes(nq)),
      }))
      .filter((g) => g.entries.length > 0);
  }, [q]);

  const handlePick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between rounded-xl h-11 bg-card"
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate font-medium">{value}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[min(360px,calc(100vw-2rem))] z-50 h-[70vh] flex flex-col"
        align="start"
        sideOffset={6}
        collisionPadding={16}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('events.searchLocality', 'Buscar localidad')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0 overscroll-contain [-webkit-overflow-scrolling:touch]">
          <div className="p-1.5">
            {/* Toda la provincia */}
            <button
              type="button"
              onClick={() => handlePick(ALL_PROVINCE_LABEL)}
              className={cn(
                'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition min-h-[44px]',
                value === ALL_PROVINCE_LABEL && 'bg-accent/60 font-semibold'
              )}
            >
              <span className="truncate">{t('pharmacies.allProvince', 'Toda la provincia')}</span>
              {value === ALL_PROVINCE_LABEL && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>

            {filteredGroups.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('common.noResults', 'Sin resultados')}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.zone} className="mt-2">
                  <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.entries.map((e) => {
                    const selected = value === e.name;
                    return (
                      <button
                        key={e.slug}
                        type="button"
                        onClick={() => handlePick(e.name)}
                        className={cn(
                          'w-full flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition min-h-[44px]',
                          selected && 'bg-accent/60 font-semibold'
                        )}
                      >
                        <span className="truncate">{e.name}</span>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

const PharmaciesPage = () => {
  const { t, i18n } = useTranslation();
  const locale = locales[i18n.language] || es;

  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(() => madridNow());
  const [municipality, setMunicipality] = useState<string>(DEFAULT_MUNICIPALITY);
  const [search, setSearch] = useState('');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mode, setMode] = useState<'duty' | 'directory'>('duty');
  const [dirLimit, setDirLimit] = useState(30);

  const isAllProvince = municipality === ALL_PROVINCE_LABEL;
  const municipalityFilter = isAllProvince ? undefined : municipality;

  const { data: duty, isLoading: isLoadingDuty, isError: dutyError } =
    usePharmaciesOnDuty(selectedDate, municipalityFilter);
  const { data: dirAll, isLoading: isLoadingDir } = usePharmacyDirectory(municipalityFilter);
  // Province-wide directory used only to enrich duty rows (the duty portal
  // publishes an address and nothing else). Same request, cached separately.
  const { data: directoryForMatching } = usePharmacyDirectory(undefined);
  const { data: syncStatus } = usePharmacyGuardSyncStatus();

  const dutyAll = duty?.rows ?? [];
  /** Rows published for the previous day: the source has not published today yet. */
  const dutyIsPreviousDay = !!duty?.isPreviousDay;
  const dutySourceDate = duty?.sourceDate ?? null;
  /** Official rows exist for this date elsewhere in the province, just not here. */
  const dutyHasProvinceData = !!duty?.hasProvinceDataForDate;

  const lastSyncLabel = useMemo(() => {
    if (!syncStatus?.updated_at) return null;
    try {
      return formatInTimeZone(new Date(syncStatus.updated_at), TIMEZONE, "d MMM yyyy, HH:mm", { locale });
    } catch {
      return null;
    }
  }, [syncStatus?.updated_at, locale]);

  /** Human label of the day the shown rota was published for. */
  const dutySourceLabel = useMemo(() => {
    if (!dutySourceDate) return null;
    try {
      return formatInTimeZone(new Date(`${dutySourceDate}T12:00:00Z`), TIMEZONE, 'PPP', { locale });
    } catch {
      return dutySourceDate;
    }
  }, [dutySourceDate, locale]);
  const prevDayLabel = dutyIsPreviousDay ? dutySourceLabel : null;

  const matchesSearch = (p: any) => {
    const q = stripDiacritics(search.trim());
    if (!q) return true;
    return [p.name, p.address, p.phone, p.municipality]
      .filter(Boolean)
      .some((s: string) => stripDiacritics(s).includes(q));
  };

  const withDistanceAndSort = (arr: any[]): any[] => {
    if (!userLoc) return arr.map((p) => ({ ...p, _distance: null }));
    const enriched = arr.map((p) => {
      const d = p.lat != null && p.lng != null
        ? haversineKm(userLoc.lat, userLoc.lng, Number(p.lat), Number(p.lng))
        : null;
      return { ...p, _distance: d };
    });
    enriched.sort((a, b) => {
      if (a._distance == null && b._distance == null) return 0;
      if (a._distance == null) return 1;
      if (b._distance == null) return -1;
      return a._distance - b._distance;
    });
    return enriched;
  };

  /**
   * Duty rows carry only an address. When the official directory holds the
   * very same address in the same town, we borrow its name, phone and
   * coordinates so the card can offer "Llamar" and a precise "Cómo llegar".
   * Nothing is invented: unmatched rows keep the portal's own wording.
   */
  const dutyEnriched = useMemo(() => {
    const dir = directoryForMatching ?? [];
    // The portal returns the same pharmacy twice when it belongs to two zones.
    const seen = new Set<string>();
    const unique = (dutyAll ?? []).filter((p: any) => {
      const parsed = parseAddress(p.address);
      const key = `${normalizeMunicipalityKey(p.municipality)}|${parsed.words.join(' ')}|${parsed.number ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique.map((p: any) => {
      if (dir.length === 0) return p;
      const match = findDirectoryMatch({ address: p.address, municipality: p.municipality }, dir as any);
      if (!match) return p;
      return {
        ...p,
        name: match.name || p.name,
        phone: p.phone ?? match.phone ?? null,
        lat: p.lat ?? match.lat ?? null,
        lng: p.lng ?? match.lng ?? null,
        _fromDirectory: true,
      };
    });
  }, [dutyAll, directoryForMatching]);

  const dutyPharmacies = useMemo(
    () => withDistanceAndSort(dutyEnriched.filter(matchesSearch)),
    [dutyEnriched, search, userLoc]
  );
  const dirPharmacies = useMemo(
    () => withDistanceAndSort((dirAll ?? []).filter(matchesSearch)),
    [dirAll, search, userLoc]
  );

  

  const isToday =
    formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd') ===
    formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');

  const handleLocate = () => {
    if (userLoc) {
      setUserLoc(null);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      toast({
        title: t('pharmacies.locationUnsupported', 'Tu dispositivo no soporta geolocalización'),
        variant: 'destructive',
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        const denied = err.code === err.PERMISSION_DENIED;
        toast({
          title: denied
            ? t('pharmacies.locationPermissionDenied', 'Permiso de ubicación denegado')
            : t('pharmacies.locationError', 'No pudimos obtener tu ubicación'),
          variant: 'destructive',
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };


  return (
    <div className="min-h-screen bg-background pb-24">
      <SEO
        title="Farmacias de guardia en Málaga hoy"
        description="Consulta las farmacias de guardia abiertas hoy en Málaga capital y provincia. Direcciones, teléfonos y horario actualizado a diario."
        path="/pharmacies"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: "https://malagaevents.lovable.app/" },
              { "@type": "ListItem", position: 2, name: "Farmacias de guardia", item: "https://malagaevents.lovable.app/pharmacies" },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Farmacias de guardia en Málaga",
            itemListElement: dutyEnriched.slice(0, 20).map((p: any, idx: number) => ({
              "@type": "ListItem",
              position: idx + 1,
              item: {
                "@type": "Pharmacy",
                name: p.name,
                telephone: p.phone || undefined,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: p.address || undefined,
                  addressLocality: p.municipality || "Málaga",
                  addressRegion: "Málaga",
                  addressCountry: "ES",
                },
                ...(p.lat && p.lng ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
              },
            })),
          },
        ]}
      />
      {/* ============== HERO — compact, sanitary Mediterranean ============== */}
      <header className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 text-white px-4 sm:px-6 pt-4 pb-14 rounded-b-3xl">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-teal-300/15 blur-3xl" />
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background/60 rounded-b-3xl"
        />

        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/25">
            <Pill className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] sm:text-2xl font-bold leading-tight">
              {t('pharmacies.title', 'Farmacias')}
            </h1>
            <p className="text-[12.5px] text-white/85 leading-snug">
              {t('pharmacies.subtitleShort', 'Guardias verificadas y directorio de la provincia.')}
            </p>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 -mt-8 space-y-4 relative z-10 max-w-4xl mx-auto">
        {/* ============== Segmented control: De guardia / Directorio ============== */}
        <div
          role="tablist"
          aria-label={t('pharmacies.modeAria', 'Modo de consulta')}
          className="glass-panel p-1 flex items-center gap-1"
        >
          <button
            role="tab"
            aria-selected={mode === 'duty'}
            onClick={() => setMode('duty')}
            className={cn(
              'flex-1 h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
              mode === 'duty'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-foreground/70 hover:text-foreground'
            )}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {t('pharmacies.tabDuty', 'De guardia')}
          </button>
          <button
            role="tab"
            aria-selected={mode === 'directory'}
            onClick={() => setMode('directory')}
            className={cn(
              'flex-1 h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors',
              mode === 'directory'
                ? 'bg-foreground text-background shadow-sm'
                : 'text-foreground/70 hover:text-foreground'
            )}
          >
            <Pill className="h-4 w-4" aria-hidden="true" />
            {t('pharmacies.tabDirectory', 'Directorio')}
          </button>
        </div>

        {/* ============== Filters ============== */}
        <div className="flex flex-col gap-2">
          <LocalitySelector value={municipality} onChange={setMunicipality} />

          {mode === 'duty' && (
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] [&>*]:min-w-0">
              <Button
                variant={isToday ? 'default' : 'outline'}
                className="rounded-xl h-11 px-4"
                onClick={() => setSelectedDate(madridNow())}
                aria-pressed={isToday}
              >
                {t('pharmacies.today', 'Hoy')}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="rounded-xl h-11 w-full min-w-0 justify-start bg-card"
                    aria-label={t('pharmacies.pickDateAria', 'Elegir fecha de guardia')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="block min-w-0 truncate text-left">
                      {formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                    locale={locale}
                    weekStartsOn={1}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant={userLoc ? 'default' : 'outline'}
                className="rounded-xl h-11 px-3 min-w-0 col-span-2 sm:col-span-1"
                onClick={handleLocate}
                disabled={locating}
                aria-pressed={!!userLoc}
              >
                <LocateFixed className={cn('h-4 w-4 mr-1.5', locating && 'animate-pulse')} aria-hidden="true" />
                {locating
                  ? t('pharmacies.locating', 'Localizando…')
                  : userLoc
                  ? t('pharmacies.clearDistanceSort', 'Quitar cercanía')
                  : t('pharmacies.nearMe', 'Cerca de mí')}
              </Button>
            </div>
          )}

          {(
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="pharmacy-search" className="sr-only">
                {t('pharmacies.searchAria', 'Buscar farmacia')}
              </label>
              <Input
                id="pharmacy-search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDirLimit(30); }}
                placeholder={t('pharmacies.searchPlaceholder', 'Buscar farmacia, dirección o zona…')}
                className="pl-9 pr-9 h-11 rounded-xl bg-card"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full min-h-[32px] min-w-[32px] flex items-center justify-center"
                  aria-label={t('common.clear', 'Limpiar')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {mode === 'directory' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant={userLoc ? 'default' : 'outline'}
                className="rounded-full h-9 px-4 text-sm"
                onClick={handleLocate}
                disabled={locating}
                aria-pressed={!!userLoc}
              >
                <LocateFixed className={cn('h-4 w-4 mr-1.5', locating && 'animate-pulse')} aria-hidden="true" />
                {locating
                  ? t('pharmacies.locating', 'Localizando…')
                  : userLoc
                  ? t('pharmacies.clearDistanceSort', 'Quitar cercanía')
                  : t('pharmacies.nearMe', 'Cerca de mí')}
              </Button>
              {userLoc && (
                <span className="text-[11px] text-muted-foreground">
                  {t('pharmacies.sortedByDistance', 'Ordenado por cercanía')}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ============== DUTY MODE ============== */}
        {mode === 'duty' && (() => {
          // Build a deep-link to the official portal preserving the chosen date
          // in the exact format the portal expects (D/M/YYYY). We cannot map
          // arbitrary UI localities to portal zone IDs, so we always link to
          // the province selector with the correct date pre-populated.
          const dISO = formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd');
          const [yy, mm, dd] = dISO.split('-').map((x) => parseInt(x, 10));
          const officialDateLabel = `${dd}/${mm}/${yy}`;
          void officialDateLabel;
          const syncFailed = !!syncStatus && syncStatus.status === 'sync_error';
          const heading = isAllProvince
            ? t('pharmacies.dutyHeadingProvince', 'Farmacias de guardia en la provincia de Málaga')
            : t('pharmacies.dutyHeadingCity', {
                defaultValue: 'Farmacias de guardia en {{place}}',
                place: municipality,
              });
          return (
            <section aria-labelledby="duty-heading">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
                <h2 id="duty-heading" className="text-lg font-semibold leading-tight">
                  {heading}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}
                  {!isLoadingDuty && dutyPharmacies.length > 0 && (
                    <> · {dutyPharmacies.length === 1
                        ? t('pharmacies.dutyCountOne', '1 farmacia de guardia')
                        : t('pharmacies.dutyCount', { defaultValue: '{{count}} farmacias de guardia', count: dutyPharmacies.length })}</>
                  )}
                </span>
              </div>

              {/* Always-visible context: which town, which date, which source day. */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <Badge variant="secondary" className="rounded-full font-normal">
                  <MapPin className="h-3 w-3 mr-1" aria-hidden="true" />
                  {municipality}
                </Badge>
                <Badge variant="secondary" className="rounded-full font-normal">
                  <CalendarIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                  {formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}
                </Badge>
                {search.trim() && (
                  <Badge variant="secondary" className="rounded-full font-normal">
                    <Search className="h-3 w-3 mr-1" aria-hidden="true" />
                    {search.trim()}
                  </Badge>
                )}
              </div>

              {dutyIsPreviousDay && dutyPharmacies.length > 0 && (
                <div
                  role="status"
                  className="mb-3 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 text-[12.5px] leading-snug text-amber-900 dark:text-amber-200"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('pharmacies.prevDayTitle', 'Guardia sin confirmar para hoy')}
                  </span>
                  <p className="mt-1">
                    {t('pharmacies.prevDayBody', {
                      defaultValue:
                        'La fuente oficial aún no ha publicado el turno de hoy. Mostramos el turno publicado para {{date}}, que suele seguir vigente de madrugada. No es una guardia confirmada para hoy: llama antes de desplazarte.',
                      date: prevDayLabel ?? '',
                    })}
                  </p>
                </div>
              )}

              {isLoadingDuty ? (
                <div className="space-y-2">
                  <PharmacyCardSkeleton />
                  <PharmacyCardSkeleton />
                </div>
              ) : dutyPharmacies.length > 0 ? (
                <div className="space-y-2">
                  {dutyPharmacies.map((p: any) => (
                    <PharmacyCard
                      key={p.id}
                      pharmacy={{ ...p, municipality: p.municipality }}
                      onDuty
                      distanceKm={p._distance}
                      dutyState={dutyIsPreviousDay ? 'unconfirmed' : 'verified'}
                      dutyDateLabel={dutySourceLabel ?? undefined}
                      sourceRef={p.source_ref}
                      contactFromDirectory={p._fromDirectory}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-5 rounded-2xl border-dashed bg-card">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 opacity-70" aria-hidden="true" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {syncFailed
                        ? t(
                            'pharmacies.syncErrorMessage',
                            'No hemos podido actualizar los datos oficiales. Consulta directamente el portal del Consejo General de Farmacéuticos para esta fecha y localidad.'
                          )
                        : dutyHasProvinceData
                        ? t('pharmacies.noDataForTown', {
                            defaultValue:
                              'La fuente oficial ha publicado guardias de esta fecha para otras zonas de la provincia, pero no para {{place}}. No significa que no haya farmacia de guardia: consulta el portal oficial o el directorio.',
                            place: municipality,
                          })
                        : t(
                            'pharmacies.noDataForDate',
                            'Todavía no tenemos información actualizada de guardias para esta fecha. La fuente oficial publica el turno a primera hora de la mañana. No podemos afirmar que no haya farmacias de guardia.'
                          )}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => setMode('directory')}
                      >
                        {t('pharmacies.switchToDirectory', 'Ver directorio')}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </section>
          );
        })()}

        {/* ============== DIRECTORY MODE ============== */}
        {mode === 'directory' && (
          <section aria-labelledby="dir-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
              <h2 id="dir-heading" className="text-base font-semibold">
                {isLoadingDir
                  ? t('pharmacies.loadingDirectory', 'Cargando directorio…')
                  : t('pharmacies.dirSummary', {
                      defaultValue: '{{count}} farmacia(s) en {{place}}',
                      count: dirPharmacies.length,
                      place: municipality,
                    })}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {t('pharmacies.directoryLabel', 'Directorio informativo')}
              </span>
            </div>

            {isLoadingDir ? (
              <div className="space-y-2">
                <PharmacyCardSkeleton />
                <PharmacyCardSkeleton />
                <PharmacyCardSkeleton />
              </div>
            ) : dirPharmacies.length > 0 ? (
              <>
                <div className="space-y-2">
                  {dirPharmacies.slice(0, dirLimit).map((p: any) => (
                    <PharmacyCard key={p.id} pharmacy={p} distanceKm={p._distance} />
                  ))}
                </div>
                {dirPharmacies.length > dirLimit && (
                  <div className="mt-3 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setDirLimit((n) => n + 30)}
                      className="rounded-full"
                    >
                      {t('pharmacies.loadMore', 'Ver más')}{' '}
                      <span className="ml-1 text-muted-foreground">
                        ({dirPharmacies.length - dirLimit})
                      </span>
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                icon={AlertTriangle}
                title={t('pharmacies.noPharmaciesFound', 'Sin resultados')}
                description={t(
                  'pharmacies.directoryEmpty',
                  'No hay farmacias listadas para tu búsqueda. Prueba con otra localidad o texto.'
                )}
              />
            )}
          </section>
        )}

        {/* ============== Información y procedencia (bottom, collapsible) ============== */}
        <details className="mt-6 rounded-2xl border border-border/60 bg-card/40 open:bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium flex items-center justify-between gap-2 min-h-[44px]">
            <span className="inline-flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {t('pharmacies.provenanceTitle', 'Información y procedencia')}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" aria-hidden="true" />
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-2 text-[12.5px] text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
              <span>
                {t(
                  'pharmacies.phoneFirstAdvice',
                  'Confirma por teléfono antes de desplazarte: los turnos oficiales pueden cambiar sin previo aviso.'
                )}
              </span>
            </p>
            <p>
              {t('pharmacies.officialSourceLabel', 'Fuente oficial:')}{' '}
              <span className="font-medium text-foreground/80">
                {t('pharmacies.officialSourceName', 'Consejo General de Colegios Oficiales de Farmacéuticos (Málaga)')}
              </span>
              {lastSyncLabel && (
                <> · {t('pharmacies.lastSync', 'Actualizado')} {lastSyncLabel}</>
              )}
            </p>
            <p>
              {t(
                'pharmacies.provenanceBody',
                'Las guardias mostradas provienen del portal público del Consejo General de Colegios Oficiales de Farmacéuticos para la provincia de Málaga (ID 29). No inventamos rotaciones: si no hay datos publicados para la fecha o localidad, verás un aviso honesto.'
              )}
            </p>
          </div>
        </details>
      </main>
    </div>
  );
};

export default PharmaciesPage;

