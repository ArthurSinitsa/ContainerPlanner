import type { ReactNode, SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & {
  size?: number;
  strokeWidth?: number;
};

function Svg({ size = 18, strokeWidth = 2, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Svg strokeWidth={1.6} {...props}>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15V3M7 10l5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function FileDownIcon(props: IconProps) {
  return (
    <Svg strokeWidth={1.7} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg strokeWidth={1.8} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg strokeWidth={3} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <Svg strokeWidth={3} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 1 1-2.6-6.3M21 3v6h-6" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.2} {...props}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function BurgerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function ClipboardIcon(props: IconProps) {
  return (
    <Svg strokeWidth={1.8} {...props}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </Svg>
  );
}

/** Декоративный мини-каркас контейнера (для плиток). */
export function ContainerFrameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="46" height="34" viewBox="0 0 60 44" fill="none" {...props}>
      <path d="M8 16 L38 8 L54 16 L24 24 Z" stroke="rgba(var(--accent-rgb),.6)" strokeWidth="1.4" />
      <path d="M8 16 L8 34 L24 40 L24 24" stroke="rgba(255,255,255,.2)" strokeWidth="1.4" />
      <path d="M24 24 L24 40 L54 32 L54 16" stroke="rgba(255,255,255,.2)" strokeWidth="1.4" />
    </svg>
  );
}

/** Крупный «плавающий» каркас для hero на дашборде. */
export function HeroFrame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 260 200" fill="none" {...props}>
      <g stroke="rgba(255,255,255,.14)" strokeWidth="1">
        <path d="M40 70 L150 40 L220 70 L110 100 Z" />
        <path d="M40 70 L40 150 L110 180 L110 100" />
        <path d="M110 100 L110 180 L220 150 L220 70" />
      </g>
      <g stroke="rgba(var(--accent-rgb),.55)" strokeWidth="1.2">
        <path d="M62 92 L110 79 L140 92 L92 106 Z" />
        <path d="M62 92 L62 118 L92 130 L92 106" />
        <path d="M92 106 L92 130 L140 118 L140 92" />
      </g>
      <g stroke="rgba(var(--accent-rgb),.32)" strokeWidth="1.2">
        <path d="M120 116 L162 105 L188 116 L146 128 Z" />
        <path d="M120 116 L120 138 L146 149 L146 128" />
        <path d="M146 128 L146 149 L188 138 L188 116" />
      </g>
    </svg>
  );
}
