"use client";

import { ReactNode, useState } from "react";

type TooltipPosition = { left:number; top:number } | null;

type TextTooltipProps = {
  text?: string;
  children?: ReactNode;
  className?: string;
  as?: "span" | "div" | "p";
};

export default function TextTooltip({ text = "", children, className = "", as = "span" }: TextTooltipProps) {
  const [position,setPosition] = useState<TooltipPosition>(null);
  const value = String(text || "").trim();
  const Tag = as as any;

  function show(event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) {
    if(!value) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(520, Math.max(280, window.innerWidth - 32));
    const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16));
    const top = rect.bottom + 8 > window.innerHeight - 120 ? Math.max(16, rect.top - 120) : rect.bottom + 8;
    setPosition({ left, top });
  }

  function hide() {
    setPosition(null);
  }

  return <Tag
    className={`text-tooltip-anchor ${className}`.trim()}
    onMouseEnter={show}
    onMouseLeave={hide}
    onFocus={show}
    onBlur={hide}
    tabIndex={value ? 0 : undefined}
    aria-label={value || undefined}
  >
    {children ?? value}
    {position && <span className="text-tooltip-floating" style={{ left: position.left, top: position.top }} role="tooltip">
      {value}
    </span>}
  </Tag>;
}
