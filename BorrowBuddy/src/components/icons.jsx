// Small line icons drawn on a 24px grid. They inherit the surrounding text color.
const PATHS = {
  home: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-6h4v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>,
  pin: <><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21Z" /><circle cx="12" cy="9.500" r="2.500" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  loans: <><path d="M4 8h13l-3.500-3.500" /><path d="M20 16H7l3.500 3.500" /></>,
  tools: <path d="M14.500 6.500a4 4 0 0 1 5.300-1.200l-2.800 2.800 1.900 1.900 2.800-2.800a4 4 0 0 1-5.500 5.300L8 20.700a2 2 0 0 1-2.800-2.800l7.200-7.700a4 4 0 0 1 2.100-3.700Z" />,
  electronics: <><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M2 19.500h20" /></>,
  books: <><path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500Z" /><path d="M4 20.500A2.500 2.500 0 0 0 6.500 21H20v-3" /></>,
  kitchen: <><path d="M7 3v7a2.500 2.500 0 0 0 5 0V3" /><path d="M9.500 3v18" /><path d="M17 21v-7h-2.500V7c0-2.500 1.500-4 2.500-4Z" /></>,
  dorm: <><path d="M3 18v-7" /><path d="M21 18v-5a3 3 0 0 0-3-3h-7v5" /><path d="M3 15h18" /><circle cx="7" cy="11.500" r="1.700" /><path d="M3 18.500h18" /></>,
  outdoors: <><path d="m3 19 6.500-12 4 7 2-3 5.500 8Z" /><circle cx="17.500" cy="6" r="1.800" /></>,
  events: <><path d="m4 20 4.500-12 7 7Z" /><path d="M14 4.500c.8 1 .8 2 0 3M20 9c-1-.7-2-.7-3 0M19 4l-.01.01M21 14l-.01.01" /></>,
  other: <><path d="M4 8.500 12 4l8 4.500v8L12 21l-8-4.500Z" /><path d="m4 8.500 8 4.500 8-4.500M12 13v8" /></>,
};

export function Icon({ name, size = 24 }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.700"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.other}
    </svg>
  );
}
