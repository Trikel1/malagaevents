import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { es, enUS, de, fr, it, pt, ja, zhCN, ru, type Locale } from 'date-fns/locale';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import EmptyState from '@/components/common/EmptyState';
import { PharmacyCardSkeleton } from '@/components/common/LoadingSkeleton';
import { usePharmaciesOnDuty, usePharmacyDirectory } from '@/hooks/usePharmacies';
import { LOCALITIES_CATALOG, ZONE_LABELS, ZONE_ORDER, type ZoneKey } from '@/lib/localitiesCatalog';
import { haversineKm, formatDistance } from '@/lib/distance';
import { cn } from '@/lib/utils';

const locales: Record<string, Locale> = {
  es, en: enUS, de, fr, it, pt, ja, zh: zhCN, ru,
};

const TIMEZONE = 'Europe/Madrid';
const DEFAULT_MUNICIPALITY = 'Málaga';

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
}

const PharmacyCard = ({ pharmacy, onDuty = false }: PharmacyCardProps) => {
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
            <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              {t('pharmacies.onDutyToday', 'De guardia hoy')}
            </Badge>
          )}
        </div>

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
      <PopoverContent className="p-0 w-[min(360px,calc(100vw-2rem))] z-50" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder={t('events.searchLocality', 'Buscar localidad')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          <div className="p-1.5">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t('common.noResults', 'Sin resultados')}
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.zone} className="mt-2 first:mt-0">
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

  const [selectedDate, setSelectedDate] = useState<Date>(() => madridNow());
  const [municipality, setMunicipality] = useState<string>(DEFAULT_MUNICIPALITY);
  const [search, setSearch] = useState('');

  const { data: dutyAll, isLoading: isLoadingDuty } =
    usePharmaciesOnDuty(selectedDate, municipality);
  const { data: dirAll, isLoading: isLoadingDir } = usePharmacyDirectory(municipality);

  const matchesSearch = (p: any) => {
    const q = stripDiacritics(search.trim());
    if (!q) return true;
    return [p.name, p.address, p.phone, p.municipality]
      .filter(Boolean)
      .some((s: string) => stripDiacritics(s).includes(q));
  };

  const dutyPharmacies = useMemo(
    () => (dutyAll ?? []).filter(matchesSearch),
    [dutyAll, search]
  );
  const dirPharmacies = useMemo(
    () => (dirAll ?? []).filter(matchesSearch),
    [dirAll, search]
  );

  const isToday =
    formatInTimeZone(selectedDate, TIMEZONE, 'yyyy-MM-dd') ===
    formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');

  return (
    <div className="min-h-screen bg-background pb-24">
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
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
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

        {/* On-duty section */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-semibold">
              {t('pharmacies.onDutyTitle', 'Farmacias de guardia')}
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
              {dutyPharmacies.map((p) => (
                <PharmacyCard key={p.id} pharmacy={{ ...p, municipality: (p as any).municipality }} onDuty />
              ))}
            </div>
          ) : (
            <Card className="p-5 text-center text-sm text-muted-foreground rounded-2xl border-dashed">
              <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-60" />
              {t('pharmacies.noOnDutyPharmacies', 'No hay farmacias de guardia disponibles para esta fecha y localidad.')}
            </Card>
          )}
        </section>

        {/* All pharmacies in locality */}
        <section className="pt-2">
          <h2 className="text-base font-semibold mb-2">
            {t('pharmacies.allPharmaciesInLocation', 'Todas las farmacias en')} {municipality}
          </h2>

          {isLoadingDir ? (
            <div className="space-y-2">
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
              <PharmacyCardSkeleton />
            </div>
          ) : dirPharmacies.length > 0 ? (
            <div className="space-y-2">
              {dirPharmacies.map((p) => (
                <PharmacyCard key={p.id} pharmacy={p} />
              ))}
            </div>
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
