import { useRef, useState, useEffect } from "react";
import type { MapNode } from "./model";
export type Popover = { node: MapNode; x: number; y: number; pinned: boolean };
export function DetailPopover({
  value,
  onClose,
  onEnter,
  onLeave,
}: {
  value: Popover;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const [pos, setPos] = useState({ x: value.x, y: value.y });
  useEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    setPos({
      x: Math.max(
        12,
        Math.min(value.x, window.innerWidth - (box?.width ?? 320) - 12),
      ),
      y: Math.max(
        12,
        Math.min(value.y, window.innerHeight - (box?.height ?? 250) - 12),
      ),
    });
    if (value.pinned) ref.current?.focus();
  }, [value]);
  return (
    <section
      ref={ref}
      tabIndex={-1}
      role={value.pinned ? "dialog" : "tooltip"}
      aria-label={value.node.data.title}
      className="detail-popover"
      style={{ left: pos.x, top: pos.y }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="popover-heading">
        <h2>{value.node.data.title}</h2>
        <button onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>
      <p>
        {value.pinned
          ? value.node.data.details
          : value.node.data.details.slice(0, 220)}
      </p>
      {!value.pinned && <small>Click the idea to read more</small>}
    </section>
  );
}
