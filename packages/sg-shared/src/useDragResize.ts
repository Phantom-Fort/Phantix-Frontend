import { useCallback, useRef, useState } from "react";
import type * as React from "react";

export type DragSide = "start" | "end";

export type DragResize = {
  /** Current pane size in px. */
  size: number;
  /** True while the user is actively dragging (for handle styling). */
  dragging: boolean;
  /** Attach to the handle's onMouseDown. */
  onHandleMouseDown: (e: React.MouseEvent) => void;
  /** Programmatically set the size (clamped). */
  setSize: (v: number) => void;
  min: number;
  max: number;
};

/**
 * Reusable drag-to-resize for a horizontally resizable workbench pane.
 *
 *  - `side: "start"` — pane is on the LEFT of its handle; dragging the handle
 *    right grows the pane (delta added).
 *  - `side: "end"`   — pane is on the RIGHT of its handle; dragging the handle
 *    left grows the pane (delta subtracted).
 *
 * The size is clamped to [min, max] on every move, and the handle element gets
 * `data-dragging` so CSS can highlight it mid-drag.
 */
export function useDragResize({
  initial,
  min,
  max,
  side,
  onChange,
}: {
  initial: number;
  min: number;
  max: number;
  side: DragSide;
  onChange?: (size: number) => void;
}): DragResize {
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);
  const [size, setSizeState] = useState(() => clamp(initial));
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; size: number } | null>(null);

  const setSize = useCallback(
    (v: number) => {
      setSizeState(clamp(v));
      onChange?.(clamp(v));
    },
    [clamp, onChange],
  );

  const onHandleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      start.current = { x: e.clientX, size };
      setDragging(true);

      const onMove = (ev: MouseEvent) => {
        if (!start.current) return;
        const dx = ev.clientX - start.current.x;
        const next = side === "start" ? start.current.size + dx : start.current.size - dx;
        setSizeState(clamp(next));
      };
      const onUp = (ev: MouseEvent) => {
        if (start.current) {
          const dx = ev.clientX - start.current.x;
          const next = side === "start" ? start.current.size + dx : start.current.size - dx;
          setSize(clamp(next));
        }
        start.current = null;
        setDragging(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [clamp, setSize, side, size],
  );

  return { size, dragging, onHandleMouseDown, setSize, min, max };
}
