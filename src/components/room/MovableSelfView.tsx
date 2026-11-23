"use client";

import { useRef, useState, type ReactNode } from "react";
import { Move } from "lucide-react";

export function MovableSelfView({ children }: { children: ReactNode }) {
  const tile = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return <div ref={tile} className="meet-filmstrip meet-movable-self" style={{
    left: `${position.x}%`, top: `${position.y}%`, right: "auto", bottom: "auto",
    transform: `translate(-${position.x}%, -${position.y}%)`,
  }}>
    {children}
    <button type="button" className="meet-self-drag" aria-label="Move self-view. Drag or use arrow keys. Home resets position."
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
      }}
      onPointerMove={event => {
        if (!drag.current || !tile.current?.parentElement) return;
        const bounds = tile.current.parentElement.getBoundingClientRect();
        const size = tile.current.getBoundingClientRect();
        setPosition({
          x: clamp(drag.current.left + (event.clientX - drag.current.x) / Math.max(1, bounds.width - size.width) * 100),
          y: clamp(drag.current.top + (event.clientY - drag.current.y) / Math.max(1, bounds.height - size.height) * 100),
        });
      }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
        event.preventDefault();
        setPosition(value => event.key === "Home" ? { x: 100, y: 100 } : {
          x: clamp(value.x + (event.key === "ArrowLeft" ? -10 : event.key === "ArrowRight" ? 10 : 0)),
          y: clamp(value.y + (event.key === "ArrowUp" ? -10 : event.key === "ArrowDown" ? 10 : 0)),
        });
      }}><Move size={15} />Move</button>
  </div>;
}
