import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";


/**
 * Automated a11y smoke tests using axe-core.
 *
 * NOTE: jsdom does not compute real layout/colors, so axe's
 * `color-contrast` rule is auto-disabled in this environment.
 * Real contrast checks need a browser-based runner (Playwright +
 * @axe-core/playwright) against the running preview. These tests
 * still catch missing alt text, labels, ARIA, landmark, and
 * heading-order issues on every build.
 */

// Static fragments that mirror the Home hero — kept self-contained so
// the test does not need providers (i18n, router, query, theme).
function HeroFragment() {
  return (
    <div>
      <header>
        <p>Agenda de la ciudad</p>
        <h1>¿Qué hacemos hoy en Málaga?</h1>
        <p>Eventos, planes y experiencias cerca de ti.</p>
        <form role="search">
          <label htmlFor="q">Buscar</label>
          <input id="q" type="search" placeholder="Buscar eventos, lugares…" />
        </form>
      </header>
      <main>
        <section>
          <h2>Hoy en Málaga</h2>
          <ul>
            <li>
              <a href="/events/1">
                <img src="/placeholder.svg" alt="Evento de ejemplo" width={320} height={180} />
                Ejemplo
              </a>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

describe("a11y", () => {
  it("Home hero fragment has no a11y violations", async () => {
    const { container } = render(<HeroFragment />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
