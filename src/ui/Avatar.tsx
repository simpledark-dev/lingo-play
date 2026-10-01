import { memo, useId } from 'react'

/** The default profile picture. Everyone has the same one until uploads exist. */
export const Avatar = memo(function Avatar({
  size = 40,
  ring,
  className = '',
}: {
  size?: number
  ring?: string
  className?: string
}) {
  const uid = useId()
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a78f5" />
          <stop offset="1" stopColor="#27337f" />
        </linearGradient>
        <linearGradient id={`${uid}fg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3f6ff" />
          <stop offset="1" stopColor="#c3d0f7" />
        </linearGradient>
        <clipPath id={`${uid}clip`}>
          <circle cx="32" cy="32" r="32" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${uid}clip)`}>
        <rect width="64" height="64" fill={`url(#${uid}bg)`} />
        <circle cx="52" cy="10" r="16" fill="#fff" opacity="0.08" />
        <path d="M9 67C9 52 20.500 46 32 46C43.500 46 55 52 55 67Z" fill={`url(#${uid}fg)`} />
        <circle cx="32" cy="27.500" r="11.500" fill={`url(#${uid}fg)`} />
        {/* headphones, the one nod to the brand */}
        <path d="M19 28.500C19 10.500 45 10.500 45 28.500" fill="none" stroke="#ff9a3d" strokeWidth="3" strokeLinecap="round" />
        <rect x="15.500" y="24.500" width="6.500" height="11.500" rx="3.200" fill="#ff8a2a" />
        <rect x="42" y="24.500" width="6.500" height="11.500" rx="3.200" fill="#ff8a2a" />
      </g>
    </svg>
  )
})
