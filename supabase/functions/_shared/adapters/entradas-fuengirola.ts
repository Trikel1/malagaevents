// Entradas Fuengirola (plataforma SecuTix del Ayuntamiento de Fuengirola).
//
// Auditoría 2026-09-08: el listado sí publica día, hora, recinto y enlace de
// venta en HTML plano; la fuente devolvía 0 porque se leía con selectores que
// ya no existen. No se inventa hora: si la entrada no publica hora, se marca
// como hora sin confirmar.

import type { SourceAdapter, CanonicalEvent } from "../ingestion/types.ts";
import { madridWallTimeToDate } from "../ingestion/dates.ts";
import { parseSecutixList } from "../ingestion/secutixList.ts";

const BASE = "https://entradas.fuengirola.es";
const LIST_URL = `${BASE}/list/events?lang=es`;
const USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app; contacto via web)";

export const entradasFuengirolaAdapter: SourceAdapter = {
  key: "entradas-fuengirola",
  name: "Entradas Fuengirola",
  fetchEvents: async (ctx) => {
    let html = "";
    try {
      const response = await fetch(LIST_URL, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html", "Accept-Language": "es-ES,es;q=0.9" },
      });
      if (!response.ok) {
        ctx.logger.error("entradas-fuengirola: respuesta no válida", { status: response.status });
        return [];
      }
      html = await response.text();
    } catch (error) {
      ctx.logger.error("entradas-fuengirola: fallo de red", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }

    const { events, skippedWithoutDate } = parseSecutixList(html, BASE);
    ctx.logger.info("entradas-fuengirola: listado leído", {
      returned: events.length,
      skippedWithoutDate,
    });

    return events.map((event): CanonicalEvent => {
      const occurrence = event.occurrences[0];
      const [year, month, day] = occurrence.date.split("-").map((part) => parseInt(part, 10));
      const [hour, minute] = occurrence.time
        ? occurrence.time.split(":").map((part) => parseInt(part, 10))
        : [0, 0];
      return {
        title: event.title,
        description: null,
        startAt: madridWallTimeToDate(year, month, day, hour, minute).toISOString(),
        endAt: null,
        timezone: "Europe/Madrid",
        venueName: event.venue ?? null,
        venueAddress: null,
        locality: "Fuengirola",
        category: null,
        imageUrl: event.imageUrl ?? null,
        sourceUrl: event.ticketUrl,
        ticketUrl: event.ticketUrl,
        priceText: null,
        externalId: event.externalId,
        timeAssumed: !occurrence.time,
        raw: {
          adapter: "entradas-fuengirola",
          strategy: "secutix-list",
          timeAssumed: !occurrence.time,
          skippedWithoutDate,
        },
      };
    });
  },
};
