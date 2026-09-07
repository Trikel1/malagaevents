import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, CalendarX2, Compass } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useMunicipalityBySlug, useMunicipalities } from '@/hooks/useMunicipalities';
import EventCard from '@/components/events/EventCard';
import { LifecycleStatusBadge } from '@/components/events/LifecycleStatusBadge';
import EmptyState from '@/components/common/EmptyState';
import SEO from '@/components/common/SEO';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { haversineKm, formatDistance } from '@/lib/distance';
import type { Event } from '@/types';

const NEARBY_RADII_KM = [15, 30, 50] as const;

/** Bounding box in degrees, ~1° lat = 111 km. Slightly overshoots then filters. */
function boundingBox(lat: number, lng: number, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

/** Only slugs we generate ourselves are safe to inline in a PostgREST filter. */
const SAFE_SLUG_RE = /^[a-z0-9-]{1,64}$/;

/**
 * Municipal agenda.
 *
 * Reconciliation note (audit 2026-09-07): most published events still have
 * `municipality_id` NULL and are only geolocated through
 * `location_normalized` (the municipality slug). Matching on the id alone
 * returned an empty agenda for every municipality, so we also accept an exact
 * `location_normalized` match. `lifecycle_status` is frequently NULL too, and
 * `neq` drops NULLs in PostgREST, so it is filtered client-side.
 */
const useMunicipalEvents = (
  municipalityId: string | null | undefined,
  slug: string | null | undefined,
) => {
  const safeSlug = slug && SAFE_SLUG_RE.test(slug) ? slug : null;
  return useQuery({
    queryKey: ['municipal-events', municipalityId, safeSlug],
    enabled: !!municipalityId,
    queryFn: async () => {
      if (!municipalityId) return [] as Event[];
      const nowIso = new Date().toISOString();
      let query = supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('start_at', nowIso);

      query = safeSlug
        ? query.or(`municipality_id.eq.${municipalityId},location_normalized.eq.${safeSlug}`)
        : query.eq('municipality_id', municipalityId);

      const { data, error } = await query.order('start_at', { ascending: true }).limit(60);
      if (error) throw error;
      return ((data ?? []) as Event[]).filter(
        (e) => (e as { lifecycle_status?: string | null }).lifecycle_status !== 'finished',
      );
    },
  });
};

interface NearbyRow {
  event: Event;
  distanceKm: number;
}

const useNearbyEvents = (
  municipalityId: string | null | undefined,
  slug: string | null | undefined,
  lat: number | null,
  lng: number | null,
  radiusKm: number,
) => {
  return useQuery<NearbyRow[]>({
    queryKey: ['nearby-events', municipalityId, slug, lat, lng, radiusKm],
    enabled: !!municipalityId && lat != null && lng != null,
    queryFn: async (): Promise<NearbyRow[]> => {
      if (lat == null || lng == null || !municipalityId) return [];
      const box = boundingBox(lat, lng, radiusKm);
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .gte('start_at', nowIso)
        .gte('lat', box.minLat)
        .lte('lat', box.maxLat)
        .gte('lng', box.minLng)
        .lte('lng', box.maxLng)
        .order('start_at', { ascending: true })
        .limit(80);
      if (error) throw error;
      const rows = (data ?? []) as Event[];
      return rows
        .filter((e) => {
          const row = e as Event & {
            lifecycle_status?: string | null;
            location_normalized?: string | null;
            municipality_id?: string | null;
          };
          if (row.lifecycle_status === 'finished') return false;
          // Exclude the municipality itself (id or slug), keeping NULL ids.
          if (row.municipality_id && row.municipality_id === municipalityId) return false;
          if (slug && row.location_normalized === slug) return false;
          return e.lat != null && e.lng != null;
        })
        .map<NearbyRow>((e) => ({
          event: e,
          distanceKm: haversineKm(lat, lng, Number(e.lat), Number(e.lng)),
        }))
        .filter((x) => x.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    },
  });
};


const MunicipalityAgendaPage = () => {
  const { municipalitySlug } = useParams();
  const [radiusKm, setRadiusKm] = useState<15 | 30 | 50>(15);

  const { data: municipality, isLoading: loadingM } = useMunicipalityBySlug(municipalitySlug);
  const { data: allMunicipalities } = useMunicipalities();
  const {
    data: localEvents = [],
    isLoading: loadingEvents,
    isError: localError,
    refetch: refetchLocal,
  } = useMunicipalEvents(
    municipality?.id,
    municipality?.slug,
  );
  const { data: nearby = [] } = useNearbyEvents(
    municipality?.id,
    municipality?.slug,
    municipality?.latitude != null ? Number(municipality.latitude) : null,
    municipality?.longitude != null ? Number(municipality.longitude) : null,
    radiusKm,
  );

  const municipalityById = useMemo(() => {
    const map = new Map<string, string>();
    (allMunicipalities ?? []).forEach((m) => map.set(m.id, m.name));
    return map;
  }, [allMunicipalities]);

  if (loadingM) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!municipality) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <EmptyState
          icon={MapPin}
          title="Municipio no encontrado"
          description="El municipio solicitado no está en el registro provincial."
        />
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link to="/events">Volver a eventos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`Agenda cultural de ${municipality.name} | MalagaEvents`}
        description={`Descubre los eventos culturales confirmados en ${municipality.name} (${municipality.comarca}) y sus alrededores.`}
        path={`/agenda/${municipality.slug}`}
      />

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/events" aria-label="Volver">
              <ArrowLeft className="h-4 w-4 mr-1" /> Volver
            </Link>
          </Button>
        </div>

        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{municipality.comarca}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{municipality.name}</h1>
          <p className="text-muted-foreground">
            Agenda cultural verificada · fuentes oficiales
          </p>
        </header>

        {/* LOCAL EVENTS */}
        <section aria-labelledby="local-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="local-heading" className="text-xl font-semibold">
              En {municipality.name}
            </h2>
            <Badge variant="secondary">{localEvents.length}</Badge>
          </div>

          {loadingEvents ? (
            <div className="text-sm text-muted-foreground">Cargando eventos…</div>
          ) : localError ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hemos podido cargar la agenda de {municipality.name}.
              </p>
              <Button className="mt-3 min-h-11" onClick={() => refetchLocal()}>
                Reintentar
              </Button>
            </div>
          ) : localEvents.length === 0 ? (
            <EmptyState
              icon={CalendarX2}
              title="Sin eventos confirmados"
              description={`Todavía no hay eventos culturales publicados en ${municipality.name}. Mira las opciones cercanas abajo.`}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {localEvents.map((ev) => (
                <EventCardWithVerified key={ev.id} event={ev} />
              ))}
            </div>
          )}
        </section>

        {/* NEARBY */}
        <section aria-labelledby="nearby-heading" className="space-y-3 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="nearby-heading" className="text-xl font-semibold">
              Cerca de {municipality.name}
            </h2>
            <div className="flex gap-1" role="radiogroup" aria-label="Radio de búsqueda">
              {NEARBY_RADII_KM.map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={radiusKm === r ? 'default' : 'outline'}
                  onClick={() => setRadiusKm(r)}
                  role="radio"
                  aria-checked={radiusKm === r}
                >
                  {r} km
                </Button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Estos eventos <strong>no ocurren en {municipality.name}</strong>. Se listan por proximidad
            desde el centro del municipio.
          </p>

          {nearby.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No hay eventos verificados en un radio de {radiusKm} km.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {nearby.map(({ event, distanceKm }) => {
                const mid = (event as Event & { municipality_id?: string | null }).municipality_id;
                return (
                  <div key={event.id} className="relative">
                    <EventCardWithVerified event={event} />
                    <div className="absolute top-2 left-2 flex flex-col gap-1 z-10 pointer-events-none">
                      <Badge className="bg-background/90 text-foreground border border-border shadow-sm">
                        {formatDistance(distanceKm)}
                      </Badge>
                      {mid && municipalityById.get(mid) && (
                        <Badge variant="outline" className="bg-background/90 text-[10px]">
                          {municipalityById.get(mid)}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

/**
 * Small wrapper adding the lifecycle badge + verified_at footer + source
 * link on top of the standard EventCard, without altering the shared card.
 */
const EventCardWithVerified = ({ event }: { event: Event & { verified_at?: string | null; lifecycle_status?: string | null } }) => {
  const verifiedAt = (event as Event & { verified_at?: string | null }).verified_at;
  const lifecycle = (event as Event & { lifecycle_status?: string | null }).lifecycle_status;
  return (
    <div className="relative">
      <EventCard event={event} />
      <div className="mt-1 flex items-center justify-between px-1 gap-2">
        <div className="flex items-center gap-2">
          {lifecycle && <LifecycleStatusBadge status={lifecycle as never} />}
          {verifiedAt && (
            <span className="text-[10px] text-muted-foreground">
              Verificado {formatDistanceToNow(new Date(verifiedAt), { addSuffix: true, locale: es })}
            </span>
          )}
        </div>
        {event.url && (
          <span className="text-[10px] text-muted-foreground">
            Fuente oficial verificada
          </span>
        )}
      </div>
    </div>
  );
};

export default MunicipalityAgendaPage;
