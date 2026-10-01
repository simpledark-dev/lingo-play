import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cx } from './bits'

export function Modal({
  onClose,
  children,
  className,
  sheet = true,
}: {
  onClose: () => void
  children: ReactNode
  className?: string
  /** take the whole screen on phones */
  sheet?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={cx('animate-fade fixed inset-0 z-50 flex justify-center bg-[#070b16]/75 backdrop-blur-[3px]', sheet ? 'items-stretch sm:items-center sm:p-6' : 'items-center p-4')}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        className={cx(
          'animate-rise scroll-slim relative w-full overflow-y-auto border-[#2c3a63] bg-[#0f1830] shadow-2xl',
          sheet ? 'sm:max-h-full sm:rounded-3xl sm:border' : 'max-h-full rounded-3xl border',
          className,
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/60"
          style={{ top: 14, right: 14 }}
        >
          <X size={20} strokeWidth={2.6} />
        </button>
        {children}
      </div>
    </div>
  )
}
