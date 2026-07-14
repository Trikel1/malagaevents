import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Sparkles, Calendar, Map, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

const BottomNav = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { appMode } = useAppMode();

  const navItems = useMemo(() => {
    const base = [
      { to: '/', icon: Home, label: t('nav.home') },
      { to: '/events', icon: Sparkles, label: t('nav.events') },
      { to: '/calendar', icon: Calendar, label: t('nav.calendar') },
    ];
    if (appMode === 'deportes') {
      base.push({ to: '/venues', icon: Building2, label: t('nav.venues') });
    } else {
      base.push({ to: '/map', icon: Map, label: t('nav.map', 'Mapa') });
    }
    base.push({ to: '/profile', icon: User, label: t('nav.profile') });
    return base;
  }, [appMode, t]);

  const activeIndex = useMemo(() => {
    const idx = navItems.findIndex(
      (item) =>
        location.pathname === item.to ||
        (item.to !== '/' && location.pathname.startsWith(item.to))
    );
    return idx === -1 ? 0 : idx;
  }, [location.pathname, navItems]);

  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [bubble, setBubble] = useState<{ x: number; w: number }>({ x: 0, w: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const dragStartedRef = useRef(false);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    const el = itemRefs.current[activeIndex];
    if (!track || !el) return;
    const tRect = track.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    setBubble({ x: eRect.left - tRect.left, w: eRect.width });
  }, [activeIndex]);

  useLayoutEffect(() => {
    measure();
  }, [measure, navItems.length]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  const indexFromX = useCallback((x: number): number => {
    const track = trackRef.current;
    if (!track) return activeIndex;
    let best = 0;
    let bestDist = Infinity;
    const tLeft = track.getBoundingClientRect().left;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const center = r.left - tLeft + r.width / 2;
      const d = Math.abs(center - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }, [activeIndex]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    pointerIdRef.current = e.pointerId;
    dragStartedRef.current = false;
    startPointRef.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    const start = startPointRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragStartedRef.current) {
      if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
      dragStartedRef.current = true;
      setDragging(true);
    }
    const track = trackRef.current;
    if (!track) return;
    const tRect = track.getBoundingClientRect();
    const localX = Math.max(0, Math.min(tRect.width, e.clientX - tRect.left));
    setDragX(localX - bubble.w / 2);
    setHoverIndex(indexFromX(localX));
  };

  const endPointer = (e: React.PointerEvent<HTMLButtonElement>, tapIndex: number) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    const wasDrag = dragStartedRef.current;
    dragStartedRef.current = false;
    startPointRef.current = null;
    setDragging(false);
    setDragX(null);
    const targetIndex = wasDrag && hoverIndex != null ? hoverIndex : tapIndex;
    setHoverIndex(null);
    const target = navItems[targetIndex];
    if (target && target.to !== location.pathname) {
      navigate(target.to);
    } else if (wasDrag) {
      // Snap back visually via measure
      measure();
    }
  };

  const displayIndex = dragging && hoverIndex != null ? hoverIndex : activeIndex;

  return (
    <nav
      className="fixed z-50 glass-nav bottom-nav-dock"
      style={{
        bottom: 'max(12px, env(safe-area-inset-bottom, 0px) + 4px)',
        left: '50%',
        transform: 'translateX(-50%)',
      }}
      aria-label={t('nav.primary', 'Navegación principal')}
    >
      <div
        ref={trackRef}
        className="bottom-nav-track"
        style={{ ['--item-count' as any]: navItems.length } as React.CSSProperties}
      >
        {bubble.w > 0 && (
          <span
            className="bottom-nav-bubble"
            aria-hidden
            style={{
              width: bubble.w,
              transform: `translate3d(${dragX != null ? dragX : bubble.x}px, 0, 0)`,
              transition: dragging
                ? 'none'
                : 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        )}
        {navItems.map((item, i) => {
          const isActive = i === displayIndex;
          return (
            <button
              key={item.to}
              ref={(el) => (itemRefs.current[i] = el)}
              type="button"
              onPointerDown={(e) => onPointerDown(e, i)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => endPointer(e, i)}
              onPointerCancel={(e) => endPointer(e, i)}
              onClick={() => {
                // Handles keyboard activation (Enter/Space) and any click
                // not preceded by a pointer sequence. Pointer-driven taps
                // already navigated in endPointer, so guard against double nav.
                if (pointerIdRef.current !== null) return;
                const target = navItems[i];
                if (target && target.to !== location.pathname) {
                  navigate(target.to);
                }
              }}
              className={cn(
                'bottom-nav-item',
                isActive ? 'bottom-nav-item-active' : 'bottom-nav-item-idle'
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
              style={{ touchAction: 'pan-y' }}
            >
              <span className="bottom-nav-icon-shell" aria-hidden>
                <item.icon
                  className={cn(
                    'h-[24px] w-[24px] shrink-0 transition-[transform,stroke-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                    isActive && 'stroke-[2.4px] scale-[1.12]'
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
