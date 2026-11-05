import { describe, it, expect } from "vitest";
import { parseMarbellaListing } from "../../supabase/functions/_shared/adapters/marbella-congresos";
import { parseUmaListing } from "../../supabase/functions/_shared/adapters/eventos-uma";
import { parseTorremolinosDetail } from "../../supabase/functions/_shared/adapters/palacio-congresos-torremolinos";
import { madridWallTimeToIso } from "../../supabase/functions/_shared/adapters/lib/congress-common";

const NOW = Date.parse("2026-11-05T10:00:00Z");

describe("congress adapters", () => {
  it("converts Madrid wall time across DST", () => {
    expect(madridWallTimeToIso(2026, 7, 1, 20, 0)).toBe("2026-07-01T18:00:00.000Z");
    expect(madridWallTimeToIso(2027, 2, 10, 20, 0)).toBe("2027-02-10T19:00:00.000Z");
  });

  it("parses a Marbella listing item and skips past events", () => {
    const item = (date: string, slug: string) =>
      `<div role="listitem" class="x"><div class="text-block-11">${date}</div><h2 class="heading-30">Congreso Médico</h2>` +
      `<div class="text-block-14">INICIO</div><div class="text-block-14">${date} 20:00</div>` +
      `<div class="text-block-14">FINALIZA</div><div class="text-block-14">${date} 22:00</div>` +
      `<p class="paragraph-4">Desc</p><a href="/eventos/${slug}">+</a></div>`;
    const ev = parseMarbellaListing(item("10/2/2027", "a") + item("1/1/2026", "b"), NOW);
    expect(ev).toHaveLength(1);
    expect(ev[0].startAt).toBe("2027-02-10T19:00:00.000Z");
    expect(ev[0].externalId).toBe("a");
    expect(ev[0].category).toBe("conferences");
    expect(ev[0].locality).toBe("Marbella");
  });

  it("parses a UMA card as an all-day congress range", () => {
    const html = `<div class="o_event_container"><a href="https://eventos.uma.es/event_detail/154351/detail/x.html"></a>` +
      `<p class="main"><a><strong>X Congreso Internacional.</strong></a></p>` +
      `<p class="other_data other_data--place">Facultad de Derecho, Málaga</p><p class="other_data">26/11/2026 - 27/11/2026</p></div>`;
    const [ev] = parseUmaListing(html, NOW);
    expect(ev.externalId).toBe("154351");
    expect(ev.startAt).toBe("2026-11-25T23:00:00.000Z");
    expect(ev.timeAssumed).toBe(true);
    expect(ev.category).toBe("conferences");
  });

  it("parses a Torremolinos detail page", () => {
    const html = `<h1 class="product_title entry-title">The YAY-YAY Conf</h1>` +
      `<div class="event-startdate"><div class="media-heading">29 octubre, 2027 09:00 </div></div>` +
      `<div class="event-enddate"><div class="media-heading">30 octubre, 2027 18:00 </div></div>`;
    const ev = parseTorremolinosDetail(html, "https://palacio-congresos.es/evento/the-yay-yay-conf/", NOW)!;
    expect(ev.startAt).toBe("2027-10-29T07:00:00.000Z");
    expect(ev.endAt).toBe("2027-10-30T16:00:00.000Z");
    expect(ev.externalId).toBe("the-yay-yay-conf");
    expect(ev.category).toBe("conferences");
  });
});
