import type { ReactNode } from "react";

interface IconProps {
  className?: string;
}

type IconComponent = (props: IconProps) => ReactNode;

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

function createIcon(children: ReactNode): IconComponent {
  // eslint-disable-next-line react/only-export-components -- factory sinh các icon component tĩnh; HMR vẫn hoạt động ở cấp trang.
  return function Icon({ className = "h-5 w-5" }: IconProps) {
    return (
      <svg {...svgProps} className={className}>
        {children}
      </svg>
    );
  };
}

export const Icons = {
  overview: createIcon(
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>,
  ),
  checkin: createIcon(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ),
  history: createIcon(
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </>,
  ),
  employees: createIcon(
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.4 3.4-5 6.5-5s5.7 1.6 6.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 15.2c2.6.2 4.7 1.7 5.5 4.8" />
    </>,
  ),
  shifts: createIcon(
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9.5h18" />
      <path d="M8 2.5V6M16 2.5V6" />
    </>,
  ),
  leave: createIcon(
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 1-1-1V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 14h6M9 17.5h4" />
    </>,
  ),
  report: createIcon(
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>,
  ),
  settings: createIcon(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z" />
    </>,
  ),
  bell: createIcon(
    <>
      <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>,
  ),
  menu: createIcon(<path d="M4 6h16M4 12h16M4 18h16" />),
  close: createIcon(<path d="M6 6l12 12M18 6L6 18" />),
  chevronLeft: createIcon(<path d="M14 6l-6 6 6 6" />),
  chevronDown: createIcon(<path d="M6 9l6 6 6-6" />),
  search: createIcon(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>,
  ),
  logout: createIcon(
    <>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>,
  ),
  user: createIcon(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5" />
    </>,
  ),
  calendar: createIcon(
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9.5h18M8 2.5V6M16 2.5V6" />
    </>,
  ),
  inbox: createIcon(
    <>
      <path d="M22 12h-5l-2 3h-6l-2-3H2" />
      <path d="M5 4h14l3 8v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-8z" />
    </>,
  ),
  alert: createIcon(
    <>
      <path d="M12 3 2.5 20h19z" />
      <path d="M12 10v4M12 17.5v.5" />
    </>,
  ),
  arrowRight: createIcon(<path d="M5 12h14M13 6l6 6-6 6" />),
};

export type IconName = keyof typeof Icons;
