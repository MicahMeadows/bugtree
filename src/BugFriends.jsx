export default function BugFriends({ className = '' }) {
  const friends = [
    { x: 36, y: 38, color: '#c7e1ef', tilt: -9 },
    { x: 115, y: 57, color: '#f6c2d3', tilt: 6 },
    { x: 194, y: 30, color: '#f5e5a4', tilt: -5 },
    { x: 273, y: 48, color: '#dfc8ed', tilt: 7 },
    { x: 352, y: 35, color: '#c4e3db', tilt: -6 },
    { x: 431, y: 51, color: '#f4c6b0', tilt: 5 },
    { x: 510, y: 27, color: '#d5cbf0', tilt: 8 },
  ]
  return <svg className={`bug-friends ${className}`} viewBox="0 0 570 142" fill="none" aria-hidden="true">
    {friends.map(({x,y,color,tilt}, i) => <g key={x} transform={`translate(${x} ${y}) rotate(${tilt} 25 70)`} stroke="#50445e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 74-5 69M5 89-8 92M9 103-3 114M47 74l12-5M49 89l13 3M45 103l12 11" />
      <ellipse cx="27" cy="87" rx="26" ry="43" fill={color} />
      <path d="M27 65v64" opacity=".45" />
      <path d="M16 45 10 24m28 21 7-21" />
      <circle cx="9" cy="22" r="3" fill={color} /><circle cx="46" cy="22" r="3" fill={color} />
      <ellipse cx="27" cy="53" rx="24" ry="22" fill={color} />
      <circle cx="19" cy="51" r="2.3" fill="#50445e" stroke="none" /><circle cx="35" cy="51" r="2.3" fill="#50445e" stroke="none" />
      <path d="m23 58 4 3 4-3" /><ellipse cx="12" cy="58" rx="4" ry="2" fill="#ef9daf" stroke="none" opacity=".7" /><ellipse cx="42" cy="58" rx="4" ry="2" fill="#ef9daf" stroke="none" opacity=".7" />
      {i % 2 === 0 && <g fill="#fff9ed" stroke="none" opacity=".8"><circle cx="14" cy="82" r="4" /><circle cx="40" cy="94" r="4" /><circle cx="13" cy="106" r="3" /></g>}
    </g>)}
    <path d="M103 16c-7-10-17 2 0 11 17-9 7-21 0-11Z" fill="#efacc4" stroke="#a17490" strokeWidth="1.2" />
    <path d="M336 10c-6-8-14 2 0 9 14-7 6-17 0-9Z" fill="#cab3e5" stroke="#8e75ae" strokeWidth="1.2" />
  </svg>
}
