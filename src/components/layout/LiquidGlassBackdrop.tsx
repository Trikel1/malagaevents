/**
 * Global fluid liquid-glass background layer.
 * Sits behind all page content, driven by [data-mode] and [data-route]
 * on its ancestor container for smooth CSS transitions between routes/modes.
 */
const LiquidGlassBackdrop = () => {
  return (
    <div className="liquid-backdrop" aria-hidden>
      <div className="liquid-blob liquid-blob-1" />
      <div className="liquid-blob liquid-blob-2" />
    </div>
  );
};

export default LiquidGlassBackdrop;
