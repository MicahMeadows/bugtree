import bugtreeIcon from './assets/bugtree-icon.png'

const paths = {
  cards: <><rect x="7" y="3" width="14" height="17" rx="2" /><path d="M4 7H3v14h14v-1M11 8h6M11 12h6" /></>,
  shuffle: <><path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4M14 8c1-1 2-2 4-2h3m-4-4 4 4-4 4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m14 6-6 6 6 6M8 12h12" />,
  edit: <><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" /></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  tree: <><rect x="3" y="8" width="5" height="7" rx="1" /><path d="M8 12h5M13 5v14M13 5h3M13 12h3M13 19h3" /><rect x="16" y="2" width="5" height="6" rx="1" /><rect x="16" y="9" width="5" height="6" rx="1" /><rect x="16" y="16" width="5" height="6" rx="1" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
  unlock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0M12 14v3" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" /></>,
  save: <><path d="M4 3h13l4 4v14H3V3ZM7 3v6h9V3M7 21v-8h10v8" /></>,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></>,
  undo: <><path d="M4 10h10a6 6 0 0 1 0 12M4 10l5-5M4 10l5 5" /></>,
  fit: <path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5" />,
  down: <path d="m6 9 6 6 6-6" />,
  up: <path d="m6 15 6-6 6 6" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
}
export function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.tree}</svg>
}
export function Beetle({ size = 32 }) {
  return <img src={bugtreeIcon} width={size} height={size} alt="" aria-hidden="true" className="bugtree-icon" />
}
