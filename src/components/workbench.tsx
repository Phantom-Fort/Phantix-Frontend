import React from "react";
import { cx } from "@/lib/utils";

/**
 * Workbench composites — shared building blocks for the Autonomous Pentest
 * Agent surfaces (drawer + operator console). These pair with the `.wb-*`
 * fluid-scaling CSS so every pane, header and handle stays proportional as it
 * is resized.
 */

/** Draggable vertical divider between two panes. */
export function ResizeHandle({
  onMouseDown,
  dragging,
  label,
  onDoubleClick,
  className,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  dragging?: boolean;
  label: string;
  /** Double-click resets the pane to its default size. */
  onDoubleClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={onDoubleClick ? `${label} — drag to resize, double-click to reset` : `${label} — drag to resize`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      data-dragging={dragging ? "true" : "false"}
      className={cx("wb-resize w-1.5 shrink-0", className)}
    />
  );
}

/** Consistent, pane-scaled section header (icon + label + optional trailing). */
export function PaneHeader({
  icon,
  title,
  right,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-1.5", className)}>
      {icon && <span className="shrink-0 text-gold-400">{icon}</span>}
      <p className="wb-pane-title min-w-0 flex-1 truncate">{title}</p>
      {right && <div className="ml-auto flex shrink-0 items-center gap-1">{right}</div>}
    </div>
  );
}
