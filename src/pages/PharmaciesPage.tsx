import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { getDateLocale } from '@/i18n/dateLocale';
import {
  Phone, MapPin, Calendar as CalendarIcon, Clock, AlertTriangle,
  Search, ChevronDown, Check, Navigation, X, Pill, LocateFixed, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/adaptive';
import SEO from '@/components/common/SEO';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import { usePharmaciesOnDuty, usePharmacyDirectory } from '@/hooks/usePharmacies';
import { LOCALITIES_CATALOG, ZONE_LABELS, ZONE_ORDER, type ZoneKey } from '@/lib/localitiesCatalog';
import { haversineKm, formatDistance } from '@/lib/distance';
import { cn } from '@/lib/utils';


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
            <Badge className="shrink-0 text-white bg-emerald-500 hover:bg-emerald-500">
              <Clock className="h-3 w-3 mr-1" />
              {t('pharmacies.onDutyToday', 'De guardia hoy')}
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
            <Button asChild size="sm" className="flex-1 min-h-11">
              <a
                href={`tel:${formatPhoneForLink(pharmacy.phone)}`}
                aria-label={`${t('pharmacies.call', 'Llamar')} ${pharmacy.name} · ${pharmacy.phone}`}
              >
                <Phone className="h-4 w-4 mr-1.5" aria-hidden />
                {t('pharmacies.call', 'Llamar')}
              </a>
            </Button>
          )}
          {pharmacy.address && (
            <Button asChild size="sm" variant="outline" className="flex-1 min-h-11">
              <a
                href={getMapsUrl(pharmacy)}
                target="_blank"
                rel="noreferrer"
                aria-label={`${t('pharmacies.directions', 'Cómo llegar')} · ${pharmacy.name}, ${pharmacy.address}`}
              >
                <Navigation className="h-4 w-4 mr-1.5" aria-hidden />
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

  const options: SearchableSelectOption<string>[] = useMemo(() => {
    const list: SearchableSelectOption<string>[] = [];
    for (const g of PHARMACY_LOCALITY_GROUPS) {
      for (const e of g.entries) {
        list.push({
          value: e.name,
          label: e.name,
          group: g.label,
          aliases: [e.slug],
        });
      }
    }
    return list;
  }, []);

  const isAll = value === ALL_PROVINCE_LABEL;

  return (
    <SearchableSelect
      value={isAll ? null : value}
      onValueChange={(v) => onChange(v ?? ALL_PROVINCE_LABEL)}
      options={options}
      title={t('events.searchLocality', 'Buscar localidad')}
      ariaLabel={t('events.searchLocality', 'Buscar localidad')}
      searchPlaceholder={t('events.searchLocality', 'Buscar localidad')}
      clearLabel={t('pharmacies.allProvince', 'Toda la provincia')}
      allowClear
      triggerActive={!isAll}
      triggerIcon={<MapPin className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />}
      triggerLabel={value}
      className="w-full justify-between h-11 bg-card"
    />
  );
};


const PharmaciesPage = () => {
  const { t, i18n } = useTranslation();
  const locale = getDateLocale(i18n.language);

  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(() => madridNow());
  const [municipality, setMunicipality] = useState<string>(DEFAULT_MUNICIPALITY);
  const [search, setSearch] = useState('');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);



  const isAllProvince = municipality === ALL_PROVINCE_LABEL;
  const municipalityFilter = isAllProvince ? undefined : municipality;

  const { data: dutyAll, isLoading: isLoadingDuty } =
    usePharmaciesOnDuty(selectedDate, municipalityFilter);
  const { data: dirAll, isLoading: isLoadingDir } = usePharmacyDirectory(municipalityFilter);

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

  // Reset progressive pagination when filters change (Sprint UI 7)
  useEffect(() => {
    setVisibleCount(24);
  }, [municipality, search, userLoc]);

  const visibleDirPharmacies = useMemo(
    () => dirPharmacies.slice(0, visibleCount),
    [dirPharmacies, visibleCount]
  );
  const hasMoreDir = dirPharmacies.length > visibleCount;



  

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
    <div className="min-h-dvh bg-background pb-24">
      <SEO
        title={t('seo.pharmacies.title')}
        description={t('seo.pharmacies.description')}
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
      {/* Header */}
      <header className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white px-5 pt-5 pb-7 rounded-b-3xl space-y-3">
        <div className="flex items-center gap-2">
          <Pill className="h-5 w-5" />
          <div>
            <h1 className="text-xl font-bold leading-tight">{t('pharmacies.title', 'Farmacias')}</h1>
            <p className="text-[12px] text-white/85">
              {t('pharmacies.subtitle', 'Consulta farmacias de guardia y servicios cercanos.')}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pharmacies.searchPlaceholder', 'Buscar farmacia, dirección o zona…')}
            className="pl-9 pr-9 h-10 rounded-full bg-white text-foreground border-0"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={t('common.clearSearch', 'Limpiar búsqueda')}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}

        </div>
      </header>

      <main className="px-4 -mt-4 space-y-4">
        {/* Locality + date selectors */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <LocalitySelector value={municipality} onChange={setMunicipality} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-11 bg-card"
              onClick={() => setSelectedDate(madridNow())}
            >
              {t('pharmacies.today', 'Hoy')}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="rounded-xl h-11 bg-card flex-1 justify-start min-w-[140px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}
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
          </div>
        </div>

        {/* Near me */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={userLoc ? 'default' : 'outline'}
            className="rounded-full min-h-11 px-4 text-sm"
            onClick={handleLocate}
            disabled={locating}
            aria-pressed={!!userLoc}
            aria-label={userLoc
              ? t('pharmacies.clearDistanceSort', 'Quitar orden por distancia')
              : t('pharmacies.nearMe', 'Cerca de mí')}
          >
            <LocateFixed className={cn('h-4 w-4 mr-1.5', locating && 'animate-pulse')} aria-hidden />
            {locating
              ? t('pharmacies.locating', 'Localizando…')
              : userLoc
              ? t('pharmacies.clearDistanceSort', 'Quitar orden por distancia')
              : t('pharmacies.nearMe', 'Cerca de mí')}
          </Button>

          {userLoc && (
            <span className="text-[11px] text-muted-foreground">
              {t('pharmacies.sortedByDistance', 'Ordenado por cercanía')}
            </span>
          )}
        </div>

        {/* On-duty section */}
        <section aria-labelledby="on-duty-heading">
          <div className="flex items-center justify-between mb-2 gap-2">
            <h2 id="on-duty-heading" className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" aria-hidden />
              {t('pharmacies.onDutyTitle', 'Farmacias de guardia')}
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                {t('pharmacies.officialLabel', 'Oficial')}
              </Badge>
            </h2>
            <span className="text-xs text-muted-foreground">
              {isToday
                ? t('pharmacies.onDutyToday', 'De guardia hoy')
                : `${t('pharmacies.guardDate', 'Guardia el')} ${formatInTimeZone(selectedDate, TIMEZONE, 'PPP', { locale })}`}
            </span>
          </div>


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
                />
              ))}
            </div>
          ) : (
            <Card className="p-5 text-center text-sm text-muted-foreground rounded-2xl border-dashed">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-60" />
              {t(
                'pharmacies.noOfficialData',
                'No hay datos oficiales verificados de farmacias de guardia para esta fecha y localidad. Consulta la fuente oficial antes de desplazarte.'
              )}
            </Card>
          )}
        </section>

        {/* Separator to make the boundary between guardias and directorio unequivocal */}
        <div role="separator" aria-hidden="true" className="h-px bg-border/70 my-3" />

        {/* All pharmacies in locality — directorio informativo (sin badge oficial de guardia) */}
        <section className="pt-1">
          <div className="flex items-baseline justify-between mb-2 gap-3">
            <h2 className="text-base font-semibold">
              {t('pharmacies.allPharmaciesInLocation', 'Todas las farmacias en')} {municipality}
            </h2>
            {!isLoadingDir && dirPharmacies.length > 0 && (
              <span className="text-xs text-muted-foreground" aria-live="polite" data-testid="pharmacy-dir-count">
                {t('pharmacies.showingCount', {
                  defaultValue: 'Mostrando {{shown}} de {{total}}',
                  shown: visibleDirPharmacies.length,
                  total: dirPharmacies.length,
                })}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">
            {t(
              'pharmacies.directoryDisclaimer',
              'Listado informativo. La condición de guardia solo se muestra en la sección superior con datos oficiales.',
            )}
          </p>

          {isLoadingDir ? (
            <div className="space-y-2" aria-hidden="true">
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
            </div>
          ) : dirPharmacies.length > 0 ? (
            <>
              <div className="space-y-2" data-testid="pharmacy-dir-list">
                {visibleDirPharmacies.map((p: any) => (
                  <PharmacyCard key={p.id} pharmacy={p} distanceKm={p._distance} />
                ))}
              </div>
              {hasMoreDir && (
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 px-6 rounded-full"
                    onClick={() => setVisibleCount((c) => c + 24)}
                    aria-label={t('pharmacies.showMoreAria', {
                      defaultValue: 'Mostrar más farmacias ({{remaining}} pendientes)',
                      remaining: dirPharmacies.length - visibleDirPharmacies.length,
                    })}
                    data-testid="pharmacy-show-more"
                  >
                    {t('pharmacies.showMore', 'Mostrar más')}
                    <span className="ml-2 text-xs text-muted-foreground">
                      +{Math.min(24, dirPharmacies.length - visibleDirPharmacies.length)}
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
                'No hay farmacias listadas en esta localidad. Prueba con otra.'
              )}
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default PharmaciesPage;
