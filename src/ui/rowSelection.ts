import type { KeyboardEvent, MouseEvent } from 'react';

/**
 * Keyboard activation for selectable list rows. Rows keep their text content
 * in a plain container (not nested controls), so Enter/Space can safely behave
 * like a click without duplicating browser button semantics.
 */
export function handleRowSelectKeyDown(event: KeyboardEvent, onSelect: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onSelect();
  }
}

/**
 * Whole-row pointer selection without hijacking the row's own controls. The
 * keyboard path lives on the row's main text block, so clicks inside it are
 * left to that handler and do not fire twice.
 */
export function handleRowClick(event: MouseEvent<HTMLElement>, onSelect: () => void) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('button, a, input, textarea, select, label, [role="button"]')) {
    return;
  }
  onSelect();
}
