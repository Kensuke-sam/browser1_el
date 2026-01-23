
// Fullscreen spoofing logic for Webview Content
const SPOOF_HOST = 'exam.iniad.org';
const SPOOF_PATH = '/exams/2025/COT102/final-trial';
const SPOOF_PATH_LOWER = SPOOF_PATH.toLowerCase();

const isSpoofTargetPath = (pathname: string): boolean => {
  const normalized = pathname.toLowerCase();
  return normalized === SPOOF_PATH_LOWER || normalized.startsWith(`${SPOOF_PATH_LOWER}/`);
};

const shouldSpoofFullscreen = (href: string = window.location.href): boolean => {
  try {
    const parsed = new URL(href);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (!isHttp || parsed.hostname.toLowerCase() !== SPOOF_HOST) {
      return false;
    }
    // Relaxed matching: verify any part of the path matches
    const locationString = `${parsed.pathname}${parsed.search}${parsed.hash}`.toLowerCase();
    return isSpoofTargetPath(parsed.pathname) || locationString.includes(SPOOF_PATH_LOWER);
  } catch {
    return false;
  }
};

const shouldWatchSpoof = (href: string = window.location.href): boolean => {
  try {
    const parsed = new URL(href);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    return isHttp && parsed.hostname.toLowerCase() === SPOOF_HOST;
  } catch {
    return false;
  }
};

const applyFullscreenSpoof = (): void => {
  console.log('[Spoof] Logic applied via webview-preload');

  const spoofLogic = () => {
    console.log('[Spoof] Injection started (Webview Internal - Unconditional Probe)');

    const defineGetter = (target: any, prop: string, getter: () => unknown): void => {
      try {
        Object.defineProperty(target, prop, { configurable: true, get: getter });
      } catch (e) {}
    };

    const getDocEl = (): HTMLElement | null => document.documentElement || document.body;

    // 1. Spoof Fullscreen API
    const docProto = Document.prototype;
    defineGetter(docProto, 'fullscreenElement', () => getDocEl());
    defineGetter(docProto, 'webkitFullscreenElement', () => getDocEl());
    defineGetter(docProto, 'fullscreenEnabled', () => true);
    defineGetter(docProto, 'webkitFullscreenEnabled', () => true);
    defineGetter(docProto, 'fullscreen', () => true);
    defineGetter(docProto, 'webkitIsFullScreen', () => true);

    defineGetter(document, 'fullscreenElement', () => getDocEl());
    defineGetter(document, 'webkitFullscreenElement', () => getDocEl());
    defineGetter(document, 'fullscreenEnabled', () => true);
    defineGetter(document, 'webkitFullscreenEnabled', () => true);
    defineGetter(document, 'fullscreen', () => true);
    defineGetter(document, 'webkitIsFullScreen', () => true);

    // 2. Spoof Window/Screen dimensions specifically to MATCH window size
    // This tells the page: "The screen is exactly the size of this window"
    const spoofWidth = () => window.innerWidth;
    const spoofHeight = () => window.innerHeight;

    defineGetter(window, 'outerWidth', spoofWidth);
    defineGetter(window, 'outerHeight', spoofHeight);
    defineGetter(window, 'screenX', () => 0);
    defineGetter(window, 'screenY', () => 0);
    defineGetter(window, 'screenLeft', () => 0);
    defineGetter(window, 'screenTop', () => 0);

    const setScreenProp = (prop: string, getter: () => number): void => {
      try {
        defineGetter(window.screen, prop, getter);
      } catch {}
      try {
        if (typeof Screen !== 'undefined') {
          defineGetter(Screen.prototype, prop, getter);
        }
      } catch {}
    };

    setScreenProp('width', spoofWidth);
    setScreenProp('height', spoofHeight);
    setScreenProp('availWidth', spoofWidth);
    setScreenProp('availHeight', spoofHeight);
    setScreenProp('availLeft', () => 0);
    setScreenProp('availTop', () => 0);
    setScreenProp('colorDepth', () => 24);
    setScreenProp('pixelDepth', () => 24);

    // 3. No-op requests to enter/exit fullscreen
    const noOpPromise = () => Promise.resolve();
    try {
      if (Element.prototype.requestFullscreen) Element.prototype.requestFullscreen = noOpPromise;
      // @ts-ignore
      if (Element.prototype.webkitRequestFullscreen) Element.prototype.webkitRequestFullscreen = noOpPromise;
      // @ts-ignore
      document.exitFullscreen = noOpPromise;
      // @ts-ignore
      if (document.webkitExitFullscreen) document.webkitExitFullscreen = noOpPromise;
    } catch {}

    // 4. Spoof matchMedia
    if (typeof window.matchMedia === 'function') {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string): MediaQueryList => {
        const mql = originalMatchMedia(query);
        // Force true for ANY fullscreen query
        if (/display-mode\s*:\s*fullscreen/i.test(query) || /fullscreen/i.test(query)) {
          defineGetter(mql, 'matches', () => true);
        }
        return mql;
      };
    }

    // 5. Fire events
    const notify = () => {
      try {
        document.dispatchEvent(new Event('fullscreenchange'));
        document.dispatchEvent(new Event('webkitfullscreenchange'));
        window.dispatchEvent(new Event('resize'));
      } catch {}
    };

    // 6. Nuclear CSS Injection
    const injectCSS = () => {
      try {
        const id = 'spoof-nuclear-yellow-css';
        if (document.getElementById(id)) return;

        const style = document.createElement('style');
        style.id = id;
        style.textContent = `
          /* Force Root to Yellow */
          html, body {
            background-color: #ffd700 !important;
            background: #ffd700 !important;
            margin: 0 !important; /* Ensure no margins */
            min-height: 100vh !important;
          }

          /* Neutralize potential red containers */
          div, section, aside, main, header, footer {
             /* We can't easily guess which one is the band, so we try to catch red backgrounds */
          }

          /* Force common ID/Classes for wrappers to transparent so body yellow shows through */
          #app, #root, .app, .container, .wrapper, #content, #main, [id*="container"], [class*="container"] {
             background-color: transparent !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
      } catch {}
    };

    // 7. Active Red Hunter (MutationObserver)
    const huntRed = () => {
      // Common red values to hunt
      const redRegex = /red|#f00|#ff0000|rgb\(\s*255\s*,\s*0\s*,\s*0\s*\)|rgba\(\s*255\s*,\s*0\s*,\s*0/i;
      
      const checkAndFix = (el: HTMLElement) => {
        if (!el.style) return;
        const bg = el.style.backgroundColor || el.style.background;
        if (bg && redRegex.test(bg)) {
           el.style.backgroundColor = '#ffd700'; // Make it gold
           el.style.background = '#ffd700';
        }
      };

      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'class')) {
             checkAndFix(m.target as HTMLElement);
          }
          if (m.type === 'childList') {
            m.addedNodes.forEach(node => {
              if (node.nodeType === 1) checkAndFix(node as HTMLElement);
            });
          }
        }
      });
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: ['style', 'class'] });
     
      // Initial sweep
      document.querySelectorAll('*').forEach(el => checkAndFix(el as HTMLElement));
    };

    // Periodic & rAF enforcement
    const loop = () => {
      try {
        defineGetter(document, 'fullscreenElement', () => getDocEl());
        defineGetter(document, 'webkitFullscreenElement', () => getDocEl());
        injectCSS();
      } catch {}
      requestAnimationFrame(loop);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        notify();
        injectCSS();
        huntRed();
        loop();
      }, { once: true });
    } else {
      notify();
      injectCSS();
      huntRed();
      loop();
    }
  };

  const script = document.createElement('script');
  script.textContent = `(${spoofLogic.toString()})();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

let spoofApplied = false;
let intervalId: number | null = null;
const handleLocationChange = (): void => {
  tryApplyFullscreenSpoof();
};

const tryApplyFullscreenSpoof = (): void => {
  if (spoofApplied) {
    return;
  }
  if (!shouldSpoofFullscreen()) {
    return;
  }
  spoofApplied = true;
  applyFullscreenSpoof();
  stopSpoofWatcher();
};

const stopSpoofWatcher = (): void => {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
  window.removeEventListener('hashchange', handleLocationChange);
  window.removeEventListener('popstate', handleLocationChange);
};

const startSpoofWatcher = (): void => {
  if (!shouldWatchSpoof()) {
    return;
  }

  tryApplyFullscreenSpoof();

  intervalId = window.setInterval(handleLocationChange, 250);
  window.addEventListener('hashchange', handleLocationChange);
  window.addEventListener('popstate', handleLocationChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleLocationChange, { once: true });
  }
};

startSpoofWatcher();
