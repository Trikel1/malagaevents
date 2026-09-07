import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import "@/i18n";

import EventCard from "@/components/events/EventCard";
import BottomNav from "@/components/layout/BottomNav";
import { AppModeProvider } from "@/contexts/AppModeContext";
import type { Event } from "@/types";

/**
 * Accessibility checks against the REAL rendered components (not mock markup),
 * covering the two regressions found in the 2026-09-07 audit:
 * - EventCard nested a <button> inside its <a> (nested-interactive).
 * - BottomNav exposed icon-only tabs with no readable label.
 */

const sampleEvent = {
  id: "evt-1",
  title: "Concierto en el Teatro Cervantes",
  category: "music",
  start_at: "2026-07-15T19:30:00Z",
  venue_name: "Teatro Cervantes",
  location_normalized: "malaga",
  province: "Málaga",
  image_url: null,
  is_free: true,
  tags: ["musica"],
} as unknown as Event;

const wrap = (ui: React.ReactNode) => (
  <MemoryRouter>
    <AppModeProvider>{ui}</AppModeProvider>
  </MemoryRouter>
);

describe("a11y — rendered components", () => {
  it("EventCard with favorite control has no violations and no nested interactive", async () => {
    const { container } = render(
      wrap(<EventCard event={sampleEvent} isFavorite={false} onToggleFavorite={() => {}} />)
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Favorite button must be operable independently of the details link.
    const link = screen.getByRole("link");
    const favorite = screen.getByRole("button", { pressed: false });
    expect(link.contains(favorite)).toBe(false);
  });

  it("EventCard renders Madrid local time, not the device timezone", () => {
    render(wrap(<EventCard event={sampleEvent} />));
    // 19:30 UTC in July = 21:30 in Europe/Madrid (CEST).
    expect(screen.getByText(/21:30/)).toBeInTheDocument();
  });

  it("BottomNav exposes readable text labels for every destination", async () => {
    const { container } = render(wrap(<BottomNav />));
    const tabs = screen.getAllByRole("button");
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    tabs.forEach((tab) => {
      expect((tab.textContent ?? "").trim().length).toBeGreaterThan(0);
    });
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
