import { describe, expect, it } from 'vitest';
import { extractCocheraPosters } from '../../supabase/functions/_shared/ingestion/cochera-posters';

const base = 'https://lacocheracabaret.com/programacion/';

describe('official Cochera poster extraction', () => {
  it('keeps nested poster markup attached to its own event, never a neighboring card', () => {
    const html = `<div class="post_item"><a href="/evento/first/"><div><img src="/first.jpg" /></div></a></div>
      <div class="post_item"><a href="/evento/second/">Second event without a poster</a></div>
      <div class="post_item"><a href="/evento/third/"><div><img src="/third.jpg" /></div></a></div>`;
    const posters = extractCocheraPosters(html, base);
    expect(posters.get('https://lacocheracabaret.com/evento/first/')).toBe('https://lacocheracabaret.com/first.jpg');
    expect(posters.has('https://lacocheracabaret.com/evento/second/')).toBe(false);
    expect(posters.get('https://lacocheracabaret.com/evento/third/')).toBe('https://lacocheracabaret.com/third.jpg');
  });

  it('selects an existing high-resolution source instead of inventing a larger filename', () => {
    const posters = extractCocheraPosters(`<a href="/evento/show/"><img src="/small.jpg" srcset="/small.jpg 212w, /poster.jpg 842w, /huge.jpg 3000w" /></a>`, base);
    expect(posters.get('https://lacocheracabaret.com/evento/show/')).toBe('https://lacocheracabaret.com/poster.jpg');
  });

  it('falls back to the supplied image when no suitable srcset entry exists', () => {
    const posters = extractCocheraPosters(`<a href="/evento/show/"><img src="/poster.jpg" srcset="/huge.jpg 3000w" /></a>`, base);
    expect(posters.get('https://lacocheracabaret.com/evento/show/')).toBe('https://lacocheracabaret.com/poster.jpg');
  });

  it('decodes HTML attributes and resolves relative URLs', () => {
    const posters = extractCocheraPosters(`<a href='/evento/show/?a=1&amp;b=2'><img data-src='/poster.jpg?a=1&amp;b=2'></a>`, base);
    expect(posters.get('https://lacocheracabaret.com/evento/show/?a=1&b=2')).toBe('https://lacocheracabaret.com/poster.jpg?a=1&b=2');
  });

  it('does not accept non-HTTP images or attribute names that only contain src', () => {
    const posters = extractCocheraPosters(`<a href="/evento/first/"><img src="javascript:alert(1)"></a>
      <a href="/evento/second/"><img bogus-src="https://example.org/wrong.jpg"></a>`, base);
    expect(posters.size).toBe(0);
  });
});
