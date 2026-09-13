// Keep the flex root inside the visible area on browsers that do not support
// interactive-widget=resizes-content. Native entry points never import this.
export default function installWebViewport() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const viewport = window.visualViewport;
  if (!viewport) return () => {};

  const style = document.documentElement.style;
  let frame = null;

  const update = () => {
    frame = null;
    // Match RN Web Dimensions: pinch zoom must not shrink the flex layout.
    const height = Math.round(viewport.height * viewport.scale);
    if (height <= 0) return;
    style.setProperty('--app-viewport-height', `${height}px`);

    // Safari can pan the visual viewport when focusing an input. Follow that
    // movement at normal scale, but let users pan freely while zoomed in.
    if (Math.abs(viewport.scale - 1) < 0.01) {
      style.setProperty(
        '--app-viewport-top',
        `${Math.max(0, viewport.offsetTop)}px`,
      );
    }
  };

  const scheduleUpdate = () => {
    if (frame === null) frame = window.requestAnimationFrame(update);
  };

  update();
  viewport.addEventListener('resize', scheduleUpdate);
  viewport.addEventListener('scroll', scheduleUpdate);
  window.addEventListener('resize', scheduleUpdate);

  return () => {
    viewport.removeEventListener('resize', scheduleUpdate);
    viewport.removeEventListener('scroll', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    if (frame !== null) window.cancelAnimationFrame(frame);
    style.removeProperty('--app-viewport-height');
    style.removeProperty('--app-viewport-top');
  };
}
