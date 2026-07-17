import { cn } from '@/lib/utils'

interface PhantixLogoProps {
  className?: string
  showTagline?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function PhantixLogo({ className, showTagline = false, size = 'md' }: PhantixLogoProps) {
  const iconSize = size === 'lg' ? 32 : size === 'md' ? 24 : 20
  const textSize = size === 'lg' ? 'text-xl' : size === 'md' ? 'text-base' : 'text-sm'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="rounded bg-white/95 p-0.5 flex items-center justify-center ring-1 ring-white/50"
        style={{ width: iconSize + 6, height: iconSize + 6 }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Enhanced stylized glowing wolf head */}
          <rect x="2" y="2" width="28" height="28" rx="6" fill="#0D1B3D"/>
          <path d="M8 11 L12 6 L16 9 L20 6 L24 11 L22 18 L16 25 L10 18 Z" fill="#fff" />
          <circle cx="12" cy="13" r="1.6" fill="#0D1B3D" />
          <circle cx="20" cy="13" r="1.6" fill="#0D1B3D" />
          <path d="M12 17 Q16 20.5 20 17" stroke="#0D1B3D" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div className="leading-none">
        <div className={cn('font-bold tracking-[-0.5px] text-foreground', textSize)}>PHANTIX</div>
        {showTagline && (
          <div className="text-[9px] text-[#38BDF8] font-medium tracking-[1.5px] -mt-0.5">PROTECT. PREVENT. PERFORM.</div>
        )}
      </div>
    </div>
  )
}
