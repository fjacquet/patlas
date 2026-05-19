/**
 * Vendored, same-origin inline-SVG icon set (zero runtime dependency — no icon
 * library is added to vatlas; see CLAUDE.md minimal-deps constraint). Feather /
 * Lucide-style: 24 viewBox, `stroke="currentColor"`, no fill, round caps — so
 * every icon inherits the tile's text color and both theme twins for free.
 *
 * Authored for the v2.0 KPI-tile redesign (UIX-03). When the `icons` project's
 * render_icon MCP is available these can be regenerated from it 1:1; the public
 * API (named components, `IconProps`) stays stable.
 */
import type { ReactNode, SVGProps } from 'react'

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number }

function Svg({ size = 18, children, ...svg }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...svg}
    >
      {children}
    </svg>
  )
}

export const LayersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </Svg>
)
export const ServerIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="20" height="8" rx="2" />
    <rect x="2" y="13" width="20" height="8" rx="2" />
    <path d="M6 7h.01M6 17h.01" />
  </Svg>
)
export const BoxIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </Svg>
)
export const DatabaseIcon = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </Svg>
)
export const CpuIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="1" />
    <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
  </Svg>
)
export const MemoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="10" rx="1" />
    <path d="M7 7V5M12 7V5M17 7V5M6 17v2M18 17v2" />
  </Svg>
)
export const HardDriveIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h18M5 12 7 5h10l2 7v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6Z" />
    <path d="M9 16h.01M13 16h3" />
  </Svg>
)
export const GaugeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 13 16 9" />
    <path d="M3.5 18a9 9 0 1 1 17 0" />
    <circle cx="12" cy="13" r="1.5" />
  </Svg>
)
export const ActivityIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12h4l3 8 4-16 3 8h4" />
  </Svg>
)
export const PowerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v9" />
    <path d="M6.4 7a8 8 0 1 0 11.2 0" />
  </Svg>
)
export const PackageIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
    <path d="m7 5.5 9 5M3 8l9 5 9-5" />
  </Svg>
)
export const FileTextIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Svg>
)
export const ZapIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </Svg>
)
export const SplitIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v16M12 8c0-2 2-4 5-4M12 8c0-2-2-4-5-4M12 16c0 2 2 4 5 4M12 16c0-2-2 4-5 4" />
  </Svg>
)
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
)
export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
)
