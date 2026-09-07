import { describe, it, expect } from 'vitest';
import { parseAddress, findDirectoryMatch } from '@/lib/pharmacyAddressMatch';

// Real rows: pharmacies_guard 2026-09-07 (Marbella) and pharmacies_directory.
const DIRECTORY = [
  { id: 'd1', name: 'Farmacia Marbella Centro', address: 'Av. Ricardo Soriano, 15, 29601 Marbella', municipality: 'Marbella', phone: '952 77 23 45', lat: null, lng: null },
  { id: 'd2', name: 'Farmacia San Antonio', address: 'Calle San Antonio 37, 29601, Marbella', municipality: 'Marbella', phone: null, lat: 36.5143724, lng: -4.8862 },
  { id: 'd3', name: 'Farmacia Berdaguer', address: 'Avenida Ricardo Soriano 4, 29601, Marbella', municipality: 'Marbella', phone: null, lat: 36.5096174, lng: -4.8871 },
  { id: 'd4', name: 'Farmacia Mingorance', address: 'Avenida Ricardo Soriano 44, 29601, Marbella', municipality: 'Marbella', phone: null, lat: 36.5105867, lng: -4.8899 },
  { id: 'd5', name: 'Farmacia Torre del Mar', address: 'Avenida Andalucía 4, Torre del Mar', municipality: 'Torre del Mar', phone: '952 54 00 00', lat: 36.74, lng: -4.09 },
];

describe('pharmacy address parsing', () => {
  it('normalises street type abbreviations and drops postal noise', () => {
    expect(parseAddress('AV. RICARDO SORIANO, 4')).toEqual({
      words: ['avenida', 'ricardo', 'soriano'],
      number: '4',
    });
    expect(parseAddress('Avenida Ricardo Soriano 4, 29601, Marbella').number).toBe('4');
    expect(parseAddress('C/CAMILO JOSE CELA, 13').words).toEqual(['calle', 'camilo', 'jose', 'cela']);
  });
});

describe('linking a duty row to its directory entry', () => {
  it('matches the same street and house number across spellings', () => {
    const match = findDirectoryMatch(
      { address: 'AV. RICARDO SORIANO, 4', municipality: 'Marbella' },
      DIRECTORY
    );
    expect(match?.name).toBe('Farmacia Berdaguer');
  });

  it('does not confuse number 4 with number 44 or 15 on the same street', () => {
    expect(
      findDirectoryMatch({ address: 'AVDA. RICARDO SORIANO, 44', municipality: 'Marbella' }, DIRECTORY)?.name
    ).toBe('Farmacia Mingorance');
    expect(
      findDirectoryMatch({ address: 'AV. RICARDO SORIANO, 15', municipality: 'Marbella' }, DIRECTORY)?.name
    ).toBe('Farmacia Marbella Centro');
  });

  it('returns null when the street is not in the directory', () => {
    expect(
      findDirectoryMatch({ address: 'PZ. PUENTE DE MALAGA', municipality: 'Marbella' }, DIRECTORY)
    ).toBeNull();
  });

  it('refuses to match across municipalities', () => {
    expect(
      findDirectoryMatch({ address: 'AV. RICARDO SORIANO, 4', municipality: 'Málaga' }, DIRECTORY)
    ).toBeNull();
  });

  it('matches a locality row against its municipality entry', () => {
    // Guard rows label this town "Torre Del Mar"; both resolve to Vélez-Málaga.
    const match = findDirectoryMatch(
      { address: 'AVDA. ANDALUCIA, 4', municipality: 'Torre Del Mar' },
      DIRECTORY
    );
    expect(match?.name).toBe('Farmacia Torre del Mar');
  });

  it('refuses a match when the house number is missing on one side', () => {
    expect(
      findDirectoryMatch({ address: 'AV. RICARDO SORIANO', municipality: 'Marbella' }, DIRECTORY)
    ).toBeNull();
  });
});
