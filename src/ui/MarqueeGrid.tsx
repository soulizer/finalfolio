import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type MarqueeRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type MarqueeGridProps = {
  children: ReactNode;
  className?: string;
  /**
   * Called once when a drag ends, with the ids of every descendant marked
   * `data-marquee-id` that the rectangle touched. Selection is additive: the
   * caller decides what to do with the ids.
   */
  onMarquee: (ids: string[]) => void;
  disabled?: boolean;
};

/** Movement before a press turns into a box selection instead of a click. */
const DRAG_THRESHOLD_PX = 5;

/**
 * Rubber-band selection for photo grids. Mouse drags draw a rectangle and
 * report the ids it covers; a press that does not move stays a normal click, so
 * the tiles keep their own click handling. Touch is left alone so the grid can
 * still be scrolled with a finger.
 */
export function MarqueeGrid({ children, className, onMarquee, disabled }: MarqueeGridProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const collectedRef = useRef<string[]>([]);
  const suppressClickRef = useRef(false);
  const [rect, setRect] = useState<MarqueeRect | null>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const root = rootRef.current;
      if (disabled || !root || event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }
      const grid: HTMLDivElement = root;

      // A click right after a drag belongs to the box selection, not the tile.
      suppressClickRef.current = false;
      collectedRef.current = [];
      const startX = event.clientX;
      const startY = event.clientY;
      let moved = false;

      const readBox = (currentX: number, currentY: number) => {
        const originX = grid.getBoundingClientRect().left + grid.scrollLeft;
        const originY = grid.getBoundingClientRect().top + grid.scrollTop;
        const left = Math.min(startX, currentX) - originX;
        const top = Math.min(startY, currentY) - originY;
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        return {
          originX,
          originY,
          box: { left, top, right: left + width, bottom: top + height },
          rect: { left, top, width, height },
        };
      };

      const collect = (currentX: number, currentY: number) => {
        const { originX, originY, box, rect: nextRect } = readBox(currentX, currentY);
        const ids: string[] = [];
        grid.querySelectorAll<HTMLElement>('[data-marquee-id]').forEach((node) => {
          const bounds = node.getBoundingClientRect();
          const nodeBox = {
            left: bounds.left - originX,
            top: bounds.top - originY,
            right: bounds.right - originX,
            bottom: bounds.bottom - originY,
          };
          const intersects =
            nodeBox.right >= box.left && nodeBox.left <= box.right && nodeBox.bottom >= box.top && nodeBox.top <= box.bottom;
          const id = node.dataset.marqueeId;
          if (intersects && id) {
            ids.push(id);
          }
        });
        collectedRef.current = ids;
        setRect(nextRect);
      };

      const finish = () => {
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        grid.classList.remove('is-marqueeing');
        if (moved) {
          suppressClickRef.current = true;
          const ids = collectedRef.current;
          collectedRef.current = [];
          if (ids.length) {
            onMarquee(ids);
          }
        }
        setRect(null);
      };

      function handleMove(moveEvent: PointerEvent) {
        if (moveEvent.pointerId !== event.pointerId) {
          return;
        }
        const distance = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
        if (!moved && distance < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;
        grid.classList.add('is-marqueeing');
        collect(moveEvent.clientX, moveEvent.clientY);
      }

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [disabled, onMarquee],
  );

  return (
    <div
      ref={rootRef}
      className={['marquee-grid', className ?? ''].filter(Boolean).join(' ')}
      onPointerDown={handlePointerDown}
      // Dragging a thumbnail would start a native image drag, which cancels the
      // pointer and silently kills an in-progress box selection.
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) {
          return;
        }
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
      {rect ? (
        <span
          className="marquee-rect"
          aria-hidden="true"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        />
      ) : null}
    </div>
  );
}
