import { Activity } from 'lucide-react';
import SportsAgenda from '@/components/sports/SportsAgenda';

/**
 * Página de "Eventos deportivos" dentro del modo Deportes.
 *
 * Fuente de datos: public.sports_entities (entity_type in [tournament, match,
 * activity], status=verified, date_start no nulo) a través de useSportsAgenda.
 * No consulta ni mezcla la tabla `events` ni componentes culturales.
 */
const SportsEventsPage = () => {
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-emerald-50/90 via-background to-emerald-100/40 dark:from-emerald-950/45 dark:via-background dark:to-emerald-950/25"
      style={{
        marginBottom: 'calc(-1 * (env(safe-area-inset-bottom, 0px) + 96px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)',
      }}
    >
      <header className="bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-700 text-white border-b border-emerald-800 sticky top-0 z-40">
        <div className="p-4 space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                Agenda deportiva
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
                Eventos deportivos
              </h1>
              <p className="mt-1 text-xs text-slate-300">
                Solo eventos verificados de fuentes oficiales de Málaga y provincia.
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-slate-200">
              <Activity className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              <span>En movimiento</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] p-4 sm:p-6 lg:p-8">
        <SportsAgenda />
      </main>
    </div>
  );
};

export default SportsEventsPage;
