// `turn.js` requires jQuery internally; the dependency is deduped to the same
// hoisted copy so both the plugin and this module share one instance.
// @ts-expect-error The package ships without jQuery types.
import $ from 'jquery';

export const turn$ = $ as any;

let turnJsLoadPromise: Promise<void> | null = null;
const TURN_JS_VENDOR_VERSION = '20260331b';

function hasEnhancedTurnJsRuntime() {
  return Boolean((turn$ as any).fn?.turn && (turn$ as any).turnVerion === '5');
}

export function ensureTurnJsLoaded() {
  if (hasEnhancedTurnJsRuntime()) {
    return Promise.resolve();
  }

  if (turnJsLoadPromise) {
    return turnJsLoadPromise;
  }

  turnJsLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('turn.js can only be loaded in a browser environment.'));
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[data-turnjs5="true"][data-turnjs-version="${TURN_JS_VENDOR_VERSION}"]`,
    );
    const handleReady = () => {
      if (hasEnhancedTurnJsRuntime()) {
        resolve();
      } else {
        reject(new Error('Turn.js loaded, but the enhanced Flipify runtime did not attach correctly.'));
      }
    };

    (window as typeof window & { $?: unknown; jQuery?: unknown }).$ = turn$;
    (window as typeof window & { $?: unknown; jQuery?: unknown }).jQuery = turn$;

    if (existingScript) {
      if (existingScript.dataset.loaded === 'true' && hasEnhancedTurnJsRuntime()) {
        handleReady();
        return;
      }

      existingScript.addEventListener('load', handleReady, { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Failed to load the vendored Turn.js-5 script.')),
        { once: true },
      );
      return;
    }

    document
      .querySelectorAll<HTMLScriptElement>('script[data-turnjs5="true"]')
      .forEach((scriptNode) => scriptNode.remove());

    const script = document.createElement('script');
    script.src = `/vendor/turnjs5.js?v=${TURN_JS_VENDOR_VERSION}`;
    script.async = true;
    script.dataset.turnjs5 = 'true';
    script.dataset.turnjsVersion = TURN_JS_VENDOR_VERSION;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        handleReady();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => reject(new Error('Failed to load the vendored Turn.js-5 script.')),
      { once: true },
    );
    document.head.appendChild(script);
  });

  turnJsLoadPromise = turnJsLoadPromise.catch((error) => {
    turnJsLoadPromise = null;
    throw error;
  });

  return turnJsLoadPromise;
}
