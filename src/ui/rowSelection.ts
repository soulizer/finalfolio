import type { KeyboardEvent } from 'react';

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
