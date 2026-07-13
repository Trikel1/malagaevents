import { describe, it, expect } from 'vitest';
// deno-style .ts import works under vitest because there are no Deno-only APIs here
import { parseCsv } from '../../supabase/functions/_shared/adapters/lib/csv';

describe('parseCsv', () => {
  it('parses semicolon-separated CSV with BOM and quoted fields', () => {
    const csv = '\uFEFFtitulo;fecha_inicio;lugar\n"Concierto ""Málaga""";2026-08-01T21:00;"Teatro Cervantes"\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].titulo).toBe('Concierto "Málaga"');
    expect(rows[0].fecha_inicio).toBe('2026-08-01T21:00');
    expect(rows[0].lugar).toBe('Teatro Cervantes');
  });

  it('auto-detects comma separator', () => {
    const csv = 'a,b,c\n1,2,3\n4,5,6\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ a: '4', b: '5', c: '6' });
  });

  it('handles CRLF line endings and skips empty trailing lines', () => {
    const csv = 'x,y\r\n1,2\r\n\r\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ x: '1', y: '2' });
  });

  it('respects maxRows guard', () => {
    const csv = 'a\n1\n2\n3\n4\n5\n';
    expect(parseCsv(csv, { maxRows: 2 })).toHaveLength(2);
  });
});
