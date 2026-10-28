"use client";

import { useEffect, useRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { X } from "lucide-react";

export function RoomIconButton({ label, children, active, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode; active?: boolean }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} className={`meet-icon-button ${active ? "is-active" : ""} ${className}`} {...props}>{children}</button>;
}

export function RoomPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [title]);
  return <aside className="meet-panel" aria-label={title}>
    <header className="meet-panel-header"><h2 ref={heading} tabIndex={-1}>{title}</h2><RoomIconButton label={`Close ${title}`} onClick={onClose}><X /></RoomIconButton></header>
    <div className="meet-panel-body">{children}</div>
  </aside>;
}

export function RoomDialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`meet-dialog ${wide ? "meet-dialog-wide" : ""}`} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <header><h2>{title}</h2><RoomIconButton label={`Close ${title}`} onClick={onClose}><X /></RoomIconButton></header>{children}
  </dialog>;
}

export function RoomSwitch({ label, description, checked, disabled, onChange }: { label: string; description?: string; checked: boolean; disabled?: boolean; onChange?: () => void }) {
  return <div className="meet-setting-row"><div><span>{label}</span>{description && <p>{description}</p>}</div><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange} className={`meet-switch ${checked ? "is-on" : ""}`}><span /></button></div>;
}
