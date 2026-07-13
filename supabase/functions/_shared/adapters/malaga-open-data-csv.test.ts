// Deterministic tests for the malaga-open-data-csv adapter.
// Pure — no network, no DB. Runs under `deno test`.

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalizeCsv,
  canonicalizeRow,
  parseHorario,
} from "./malaga-open-data-csv.ts";

const CSV_URL =
  "https://datosabiertos.malaga.eu/recursos/cultura/agenda/2026.csv";

// A minimal but realistic sample of the real schema. All PII stripped.
const CSV = [
  [
    '"ID_EVENTO","EVENTO","ID_ACTIVIDAD","NOMBRE","DESCRIPCION","ACCESO_MIN",',
    '"ID_LUGAR","OTROS_LUGARES","HORARIO","TELEFONO","F_INICIO","F_FIN",',
    '"DESTINATARIOS","DESTINATARIOS_DESCRIPCION","DIRECCION_WEB","E_MAIL",',
    '"CATEGORIA","ESPECIALIDAD","ORGANIZA","EQP_DESCRIPCION","EQP_NOMBRECALLE",',
    '"EQP_DISTRITO","EQP_OTROS"',
  ].join(""),
  // 1) Date-only F_INICIO with explicit HORARIO range → should NOT be 01:00.
  '51728,"desc",144056,"Pasacalle de Reyes Distrito 11","desc","S",0,"Avda. Plutarco","17 a 20 horas","","04/01/2026 00:00:00","04/01/2026 00:00:00","TE","","https://www.malaga.eu/eventos/51728","","Fiestas populares","Cabalgatas","JMD 11","","","",""',
  // 2) Date-only with no HORARIO → timeAssumed=true, UTC-midnight sentinel.
  '51729,"desc",144057,"Charla comunitaria","desc","S",0,"","","","10/02/2026 00:00:00","10/02/2026 00:00:00","TE","","","","Colectivo","Charla","Vecinos","Centro Ciudadano","C/ Ejemplo","Centro",""',
  // 3) Explicit clock in F_INICIO — must be preserved as Madrid wall-time.
  '51730,"desc",144058,"Concierto banda","desc","N",0,"","20:30 h","","15/03/2026 20:30:00","15/03/2026 22:30:00","TE","","https://www.malaga.eu/eventos/51730","","Música","Concierto","Banda","Auditorio Eduardo Ocón","","",""',
  // 4) HORARIO range with minutes.
  '51731,"desc",144059,"Taller de barro","desc","S",0,"","de 18:30 a 21:00","","20/04/2026 00:00:00","20/04/2026 00:00:00","TE","","","","Cursos y talleres","Taller","Cultura","La Caja Blanca","","",""',
  // 5) Multi-day (exhibition) — endAt on a later calendar day.
  '51732,"desc",144060,"Exposición Ejemplo","desc","S",0,"","","","01/05/2026 00:00:00","31/05/2026 00:00:00","TE","","","","Ferias, Exposiciones y Museos","Exposición","Museo","Museo Ejemplo","","",""',
  // 6) Missing title → rejected.
  '51733,"desc",144061,"","desc","S",0,"","","","01/05/2026 00:00:00","01/05/2026 00:00:00","TE","","","","","","","","","",""',
].join("\n");

Deno.test("canonicalizeCsv parses valid rows and rejects the empty-title row", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  assertEquals(events.length, 5, "5 valid rows expected");
  assertEquals(events[0].title, "Pasacalle de Reyes Distrito 11");
});

Deno.test("date-only + HORARIO range: applies Madrid wall time, not fake midnight", () => {
  const [pasacalle] = canonicalizeCsv(CSV, CSV_URL);
  // 17:00 Madrid on 04/01/2026 (winter, +01:00) = 16:00 UTC — NOT 23:00 UTC.
  assertEquals(pasacalle.startAt, "2026-01-04T16:00:00.000Z");
  assertEquals(pasacalle.endAt, "2026-01-04T19:00:00.000Z");
  assertEquals(pasacalle.timeAssumed, undefined);
});

Deno.test("no time anywhere → timeAssumed=true, UTC-midnight sentinel", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  const charla = events.find((e) => e.title === "Charla comunitaria")!;
  assert(charla.timeAssumed === true, "expected timeAssumed=true");
  // Sentinel is UTC midnight of the Madrid calendar date.
  assertEquals(charla.startAt, "2026-02-10T00:00:00.000Z");
});

Deno.test("explicit F_INICIO clock is preserved as Madrid wall time", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  const concierto = events.find((e) => e.title === "Concierto banda")!;
  // 20:30 Madrid winter (Mar 15 is still CET, DST starts 29-Mar-2026) = 19:30 UTC.
  assertEquals(concierto.startAt, "2026-03-15T19:30:00.000Z");
  assertEquals(concierto.endAt, "2026-03-15T21:30:00.000Z");
  assertEquals(concierto.timeAssumed, undefined);
});

Deno.test("HORARIO range with minutes", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  const taller = events.find((e) => e.title === "Taller de barro")!;
  // 18:30 Madrid, 20 Apr 2026 (DST active from 29-Mar) = 16:30 UTC.
  assertEquals(taller.startAt, "2026-04-20T16:30:00.000Z");
  assertEquals(taller.endAt, "2026-04-20T19:00:00.000Z");
});

Deno.test("multi-day: F_FIN later than F_INICIO → endAt", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  const expo = events.find((e) => e.title === "Exposición Ejemplo")!;
  assert(expo.endAt, "expected endAt");
  assertEquals(expo.timeAssumed, true);
});

Deno.test("externalId preserves ID_EVENTO", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  assertEquals(events[0].externalId, "51728");
});

Deno.test("locality is Málaga; category prefers CATEGORIA over ESPECIALIDAD", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  for (const e of events) assertEquals(e.locality, "Málaga");
  assertEquals(events[0].category, "Fiestas populares");
});

Deno.test("parseHorario: recognised patterns", () => {
  assertEquals(parseHorario("17 a 20 horas"), {
    startHh: 17, startMm: 0, endHh: 20, endMm: 0,
  });
  assertEquals(parseHorario("de 18:30 a 21:00"), {
    startHh: 18, startMm: 30, endHh: 21, endMm: 0,
  });
  assertEquals(parseHorario("20:30 h"), { startHh: 20, startMm: 30 });
  assertEquals(parseHorario("a las 20 h"), { startHh: 20, startMm: 0 });
  assertEquals(parseHorario(""), null);
  assertEquals(parseHorario("Ver web"), null);
});

Deno.test("canonicalizeRow: rejects rows without a title or without a parseable date", () => {
  assertEquals(
    canonicalizeRow(
      { NOMBRE: "", F_INICIO: "04/01/2026 00:00:00" } as Record<string, string>,
      CSV_URL,
    ),
    null,
  );
  assertEquals(
    canonicalizeRow(
      { NOMBRE: "X", F_INICIO: "no-date" } as Record<string, string>,
      CSV_URL,
    ),
    null,
  );
});

Deno.test("sourceUrl falls back to CSV URL when DIRECCION_WEB is empty", () => {
  const events = canonicalizeCsv(CSV, CSV_URL);
  const charla = events.find((e) => e.title === "Charla comunitaria")!;
  assertEquals(charla.sourceUrl, CSV_URL);
});
