import installWebViewport from '../../app/functions/webViewport.web';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener: jest.fn((type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    }),
    removeEventListener: jest.fn((type, listener) => {
      listeners.get(type)?.delete(listener);
    }),
    emit(type) {
      listeners.get(type)?.forEach(listener => listener());
    },
  };
}

describe('web app viewport', () => {
  let viewport;
  let styles;
  let browser;
  let frames;
  let cleanup;
  const originalWindow = global.window;
  const originalDocument = global.document;

  function flushFrame() {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback());
  }

  beforeEach(() => {
    viewport = {
      ...eventTarget(),
      height: 800,
      offsetTop: 0,
      scale: 1,
    };
    styles = new Map();
    frames = new Map();
    let nextFrame = 0;
    browser = {
      ...eventTarget(),
      visualViewport: viewport,
      requestAnimationFrame: jest.fn(callback => {
        frames.set(++nextFrame, callback);
        return nextFrame;
      }),
      cancelAnimationFrame: jest.fn(id => frames.delete(id)),
    };
    global.window = browser;
    global.document = {
      documentElement: {
        style: {
          setProperty: (name, value) => styles.set(name, value),
          removeProperty: name => styles.delete(name),
        },
      },
    };
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    global.window = originalWindow;
    global.document = originalDocument;
  });

  it('shrinks with the keyboard and restores the full height on dismissal', () => {
    cleanup = installWebViewport();
    expect(styles.get('--app-viewport-height')).toBe('800px');

    viewport.height = 460;
    viewport.emit('resize');
    flushFrame();
    expect(styles.get('--app-viewport-height')).toBe('460px');

    viewport.height = 800;
    viewport.emit('resize');
    flushFrame();
    expect(styles.get('--app-viewport-height')).toBe('800px');
  });

  it('keeps the app below the visible top when Safari pans to an input', () => {
    cleanup = installWebViewport();
    viewport.height = 460;
    viewport.offsetTop = 120;
    viewport.emit('resize');
    viewport.emit('scroll');
    expect(frames.size).toBe(1);
    flushFrame();
    expect(styles.get('--app-viewport-top')).toBe('120px');

    viewport.offsetTop = 0;
    viewport.emit('scroll');
    flushFrame();
    expect(styles.get('--app-viewport-top')).toBe('0px');
  });

  it('does not shrink the layout or chase the user while pinch zooming', () => {
    cleanup = installWebViewport();
    viewport.scale = 2;
    viewport.height = 400;
    viewport.offsetTop = 150;
    viewport.emit('resize');
    viewport.emit('scroll');
    flushFrame();
    expect(styles.get('--app-viewport-height')).toBe('800px');
    expect(styles.get('--app-viewport-top')).toBe('0px');

    viewport.scale = 1;
    viewport.height = 800;
    viewport.offsetTop = 0;
    viewport.emit('resize');
    flushFrame();
    expect(styles.get('--app-viewport-top')).toBe('0px');
  });

  it('uses the current viewport after rotation or browser resizing', () => {
    cleanup = installWebViewport();
    viewport.height = 350;
    browser.emit('resize');
    flushFrame();
    expect(styles.get('--app-viewport-height')).toBe('350px');
  });

  it('does not subtract the keyboard twice when the browser resizes content', () => {
    viewport.height = 460;
    cleanup = installWebViewport();
    expect(styles.get('--app-viewport-height')).toBe('460px');
    expect(styles.get('--app-viewport-top')).toBe('0px');
  });

  it('leaves CSS sizing in place when VisualViewport is unavailable', () => {
    browser.visualViewport = undefined;
    cleanup = installWebViewport();
    expect(styles.size).toBe(0);
    expect(browser.addEventListener).not.toHaveBeenCalled();
  });

  it('removes listeners, pending work and sizing overrides on cleanup', () => {
    const stop = installWebViewport();
    viewport.emit('resize');
    stop();
    expect(frames.size).toBe(0);
    expect(styles.size).toBe(0);
    viewport.emit('resize');
    viewport.emit('scroll');
    browser.emit('resize');
    expect(frames.size).toBe(0);
  });
});
