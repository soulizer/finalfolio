// Site-wide panel collapse: every .editor-panel gets a small chevron toggle
// (rendered by PanelCollapseToggle). Clicking it hides the panel body without
// React re-render bookkeeping, and the collapsed state is remembered per route
// so a revisit keeps the same panels open.
import { translate } from '../i18n';

const STORAGE_KEY = 'finalfolio-panel-collapse-v1';

type CollapsedPanels = Record<string, boolean>;

function readState(): CollapsedPanels {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as CollapsedPanels) : {};
  } catch {
    return {};
  }
}

function writeState(state: CollapsedPanels) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode); collapse still works in-session.
  }
}

function panelKey(panel: Element) {
  const label = panel.querySelector(
    '.editor-panel__label, .editor-panel__heading h2, .editor-panel__heading h3, .editor-panel__heading .eyebrow',
  );
  const text = (label?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (!text) {
    return '';
  }
  return `${window.location.pathname}#${text}`;
}

function setToggleState(toggle: Element | null, collapsed: boolean) {
  if (!toggle) {
    return;
  }
  toggle.setAttribute('aria-expanded', String(!collapsed));
  (toggle as HTMLElement).title = collapsed ? translate('Expand panel') : translate('Collapse panel');
}

function applyPanel(panel: Element, collapsed: boolean) {
  panel.classList.toggle('is-collapsed', collapsed);
  setToggleState(panel.querySelector('[data-panel-toggle]'), collapsed);
}

function scan() {
  const state = readState();
  document.querySelectorAll('.editor-panel, .page-strip-panel').forEach((panel) => {
    if (!panel.querySelector('[data-panel-toggle]')) {
      return;
    }
    const key = panelKey(panel);
    applyPanel(panel, Boolean(key && state[key]));
  });
}

function handleClick(event: MouseEvent) {
  const target = event.target as Element | null;
  const toggle = target?.closest?.('[data-panel-toggle]');
  if (!toggle) {
    return;
  }
  const panel = toggle.closest('.editor-panel, .page-strip-panel');
  if (!panel) {
    return;
  }
  const collapsed = !panel.classList.contains('is-collapsed');
  applyPanel(panel, collapsed);

  const key = panelKey(panel);
  if (key) {
    const state = readState();
    if (collapsed) {
      state[key] = true;
    } else {
      delete state[key];
    }
    writeState(state);
  }
}

export function initPanelCollapse() {
  if (typeof document === 'undefined') {
    return () => undefined;
  }

  let frame = 0;
  const scheduleScan = () => {
    if (!frame) {
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scan();
      });
    }
  };

  // Typing inside a field or an image state change should not rescan every
  // panel. Only panel trees entering or leaving the DOM can change the result.
  const observer = new MutationObserver((records) => {
    const panelChanged = records.some((record) => {
      if (record.type !== 'childList') {
        return false;
      }

      return Array.from(record.addedNodes).some(
        (node) =>
          node.nodeType === 1 &&
          ((node as Element).matches('.editor-panel, .page-strip-panel') ||
            Boolean((node as Element).querySelector('.editor-panel, .page-strip-panel'))),
      );
    });

    if (panelChanged) {
      scheduleScan();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', handleClick);
  scan();

  return () => {
    observer.disconnect();
    document.removeEventListener('click', handleClick);
    if (frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
