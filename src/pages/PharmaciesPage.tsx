import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
import {
  Phone, MapPin, Calendar as CalendarIcon, AlertTriangle,
  Search, ChevronDown, Check, Navigation, X, Pill, LocateFixed, Info,
  ShieldCheck, ExternalLink,
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

const getMapsUrl = (p: { lat?: number | null; lng?: number | null; address: string; municipality?: string }) => {
  if (p.lat && p.lng) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS
      ? `maps://maps.apple.com/?daddr=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }
  const full = `${p.address}, ${p.municipality ?? 'Málaga'}, España`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
};

const formatPhoneForLink = (phone: string) => phone.replace(/[^\d+]/g, '');

interface PharmacyCardProps {
  pharmacy: {
    name: string; address: string; phone?: string | null;
    lat?: number | null; lng?: number | null; municipality?: string;
  };
  onDuty?: boolean;
  distanceKm?: number | null;
}

const PharmacyCard = ({ pharmacy, onDuty = false, distanceKm }: PharmacyCardProps) => {
  const { t } = useTranslation();
  return (
    <Card className={cn(
      'overflow-hidden rounded-2xl border-border/60 transition',
      onDuty && 'border-emerald-500/50 ring-1 ring-emerald-500/15'
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="h-9 w-9 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 shrink-0">
              <Pill className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base leading-tight truncate">{pharmacy.name}</h3>
              {pharmacy.municipality && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{pharmacy.municipality}</p>
              )}
            </div>
          </div>
          {onDuty && (
            <Badge className="shrink-0 text-white bg-emerald-600 hover:bg-emerald-600 gap-1">
              <ShieldCheck className="h-3 w-3" />
              {t('pharmacies.verifiedGuard', 'Guardia verificada')}
            </Badge>
          )}
        </div>

        {typeof distanceKm === 'number' && (
          <div className="text-[11px] text-primary font-medium mt-1 flex items-center gap-1">
            <Navigation className="h-3 w-3" />
            {formatDistance(distanceKm)} {t('pharmacies.distanceAway', 'de distancia')}
          </div>
        )}

        <div className="text-sm text-foreground/85 mt-2 flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span>{pharmacy.address}</span>
        </div>

        {pharmacy.phone && (
          <div className="text-sm text-foreground/85 mt-1.5 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{pharmacy.phone}</span>
          </div>
        )}

        <div className="mt-3 flex gap-2">
          {pharmacy.phone && (
            <Button asChild size="sm" className="flex-1">
              <a href={`tel:${formatPhoneForLink(pharmacy.phone)}`}>
                <Phone className="h-4 w-4 mr-1.5" />
                {t('pharmacies.call', 'Llamar')}
              </a>
            </Button>
          )}
          {pharmacy.address && (
            <Button asChild size="sm" variant="outline" className="flex-1">
              <a href={getMapsUrl(pharmacy)} target="_blank" rel="noreferrer">
                <Navigation className="h-4 w-4 mr-1.5" />
                {t('pharmacies.directions', 'Cómo llegar')}
              </a>
            </Button>
          )}
        </div>
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

  const { data: dutyAll, isLoading: isLoadingDuty } =
    usePharmaciesOnDuty(selectedDate, municipalityFilter);
  const { data: dirAll, isLoading: isLoadingDir } = usePharmacyDirectory(municipalityFilter);
  const { data: syncStatus } = usePharmacyGuardSyncStatus();

  const lastSyncLabel = useMemo(() => {
    if (!syncStatus?.updated_at) return null;
    try {
      return formatInTimeZone(new Date(syncStatus.updated_at), TIMEZONE, "d MMM yyyy, HH:mm", { locale });
    } catch {
      return null;
    }
  }, [syncStatus?.updated_at, locale]);

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

  const dutyPharmacies = useMemo(
    () => withDistanceAndSort((dutyAll ?? []).filter(matchesSearch)),
    [dutyAll, search, userLoc]
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
            itemListElement: (dutyAll ?? []).slice(0, 20).map((p: any, idx: number) => ({
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
            <div className="grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr_auto]">
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
                    className="rounded-xl h-11 w-full justify-start bg-card"
                    aria-label={t('pharmacies.pickDateAria', 'Elegir fecha de guardia')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap overflow-hidden text-ellipsis">
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
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant={userLoc ? 'default' : 'outline'}
                className="rounded-xl h-11 px-4 col-span-2 sm:col-span-1"
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

          {mode === 'directory' && (
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
        {mode === 'duty' && (
          <section aria-labelledby="duty-heading">
            {/* Contextual summary */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
              <h2 id="duty-heading" className="text-base font-semibold">
                {isLoadingDuty
                  ? t('pharmacies.checkingOfficial', 'Consultando datos oficiales…')
                  : dutyPharmacies.length > 0
                  ? t('pharmacies.dutySummary', {
                      defaultValue: '{{count}} guardia(s) verificada(s) en {{place}}',
                      count: dutyPharmacies.length,
                      place: municipality,
                    })
                  : t('pharmacies.dutySummaryEmpty', {
                      defaultValue: 'Sin guardias verificadas en {{place}}',
                      place: municipality,
                    })}
              </h2>
              <span className="text-xs text-muted-foreground">
                {formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}
              </span>
            </div>

            {/* Official source attribution */}
            <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>{t('pharmacies.officialSourceLabel', 'Fuente oficial:')}</span>
              <a
                href="https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary hover:underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                farmaciasguardia.farmaceuticos.com
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              {lastSyncLabel && (
                <span className="opacity-80">
                  · {t('pharmacies.lastSync', 'Actualizado')} {lastSyncLabel}
                </span>
              )}
            </div>

            {isLoadingDuty ? (
              <div className="space-y-2">
                <PharmacyCardSkeleton />
                <PharmacyCardSkeleton />
              </div>
            ) : dutyPharmacies.length > 0 ? (
              <>
                <div className="space-y-2">
                  {dutyPharmacies.map((p: any) => (
                    <PharmacyCard
                      key={p.id}
                      pharmacy={{ ...p, municipality: p.municipality }}
                      onDuty
                      distanceKm={p._distance}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 opacity-70" aria-hidden="true" />
                  <span>
                    {t(
                      'pharmacies.phoneFirstAdvice',
                      'Confirma por teléfono antes de desplazarte: los turnos oficiales pueden cambiar sin previo aviso.'
                    )}
                  </span>
                </p>
              </>
            ) : (
              <Card className="p-5 rounded-2xl border-dashed bg-card">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 opacity-70" aria-hidden="true" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {t(
                      'pharmacies.noOfficialData',
                      'No hay datos oficiales verificados para esta localidad y fecha. Esto no significa que no haya farmacias abiertas — consulta la fuente oficial antes de desplazarte.'
                    )}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button asChild size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-600/90">
                      <a
                        href="https://farmaciasguardia.farmaceuticos.com/web_guardias/publico/Provincia_pNew.asp?id=29"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-1.5" aria-hidden="true" />
                        {t('pharmacies.openOfficialSource', 'Consultar fuente oficial')}
                      </a>
                    </Button>
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
        )}

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
      </main>
    </div>
  );
};

export default PharmaciesPage;

