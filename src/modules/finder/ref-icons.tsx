// Icônes « line » mono-trait, calquées sur la maquette de référence.
// Toutes héritent de `currentColor` et se dimensionnent via width/height (em).
import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  style?: CSSProperties
  className?: string
  strokeWidth?: number
}

function base({ size = 18, style, className, strokeWidth = 1.7 }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style,
    className,
    'aria-hidden': true,
  }
}

export const IconHome = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></svg>
)
export const IconShop = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8h16l-1.2 3.2a2.4 2.4 0 0 1-4.6 0 2.4 2.4 0 0 1-4.4 0 2.4 2.4 0 0 1-4.6 0L4 8Z" /><path d="M5.5 11.5V20h13v-8.5" /><path d="M9 20v-4.2h6V20" /><path d="M9 8V5.5h6V8" /></svg>
)
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 5 5.8v5.4c0 4.4 3 7.6 7 9.8 4-2.2 7-5.4 7-9.8V5.8L12 3Z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></svg>
)
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
)
export const IconFlask = (p: IconProps) => (
  <svg {...base(p)}><path d="M10 3h4" /><path d="M10.5 3v5.2L5.6 17.4A2.4 2.4 0 0 0 7.7 21h8.6a2.4 2.4 0 0 0 2.1-3.6L13.5 8.2V3" /><path d="M8 15h8" /></svg>
)
export const IconGear = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5" /></svg>
)
export const IconBrain = (p: IconProps) => (
  <svg {...base(p)}><path d="M9.5 4.5A2.5 2.5 0 0 0 7 7a2.6 2.6 0 0 0-1.8 4.4A2.7 2.7 0 0 0 6.4 16 2.6 2.6 0 0 0 10 19.5V6a1.5 1.5 0 0 0-.5-1.5Z" /><path d="M14.5 4.5A2.5 2.5 0 0 1 17 7a2.6 2.6 0 0 1 1.8 4.4A2.7 2.7 0 0 1 17.6 16 2.6 2.6 0 0 1 14 19.5" /><path d="M10 9h4M10 13h4M10 17h2.5" /></svg>
)
export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}><path d="m9 5 7 7-7 7" /></svg>
)
export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}><path d="m5 9 7 7 7-7" /></svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
)
export const IconDoc = (p: IconProps) => (
  <svg {...base(p)}><rect x="5" y="3.5" width="14" height="17" rx="1.6" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4.5" /><path d="m15.5 14.5 2 2 3.2-3.6" strokeWidth={1.4} /></svg>
)
export const IconChip = (p: IconProps) => (
  <svg {...base(p)}><rect x="7" y="7" width="10" height="10" rx="1.6" /><rect x="10" y="10" width="4" height="4" rx="0.6" /><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" /></svg>
)
export const IconConnector = (p: IconProps) => (
  <svg {...base(p)}><path d="M10 7.5h4v4l3 3v2H7v-2l3-3v-4Z" /><path d="M10 7.5V5h4v2.5" /><path d="M9 16.5v2M12 16.5v2.5M15 16.5v2" /></svg>
)
export const IconPhone = (p: IconProps) => (
  <svg {...base(p)}><rect x="7" y="2.8" width="10" height="18.4" rx="2.2" /><path d="M10.5 5.5h3" /><path d="M11 18.6h2" /></svg>
)
export const IconDatabase = (p: IconProps) => (
  <svg {...base(p)}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" /><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></svg>
)
export const IconGrid = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="4" width="7" height="7" rx="1.2" /><rect x="13" y="4" width="7" height="7" rx="1.2" /><rect x="4" y="13" width="7" height="7" rx="1.2" /><rect x="13" y="13" width="7" height="7" rx="1.2" /></svg>
)
export const IconArrowUp = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></svg>
)
export const IconSignal = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20v-3M9 20v-6M14 20v-9M19 20V7" strokeWidth={2.2} /></svg>
)
export const IconUser = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5" /></svg>
)
export const IconStore = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 9h16l-1-4H5L4 9Z" /><path d="M5.5 9v11h13V9" /><path d="M9.5 20v-5.5h5V20" /></svg>
)
export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 8.5h3l1.4-2h7.2l1.4 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.2" r="3.4" /></svg>
)
export const IconPin = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 21s7-6.2 7-11.2A7 7 0 1 0 5 9.8C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.6" /></svg>
)
export const IconTag = (p: IconProps) => (
  <svg {...base(p)}><path d="M3.5 11.5 11 4h7.5a1 1 0 0 1 1 1V12l-7.5 7.5a1 1 0 0 1-1.4 0l-7.1-7.1a1 1 0 0 1 0-1.4Z" /><circle cx="15.5" cy="8" r="1.3" /></svg>
)
export const IconChart = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20V4" /><path d="M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6M20 16V6" /></svg>
)
