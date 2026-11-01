import { cn } from '@/lib/cn';

interface BrandMarkProps {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
}

export function BrandMark({ className, logoClassName, textClassName }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src="/logo.png"
        alt="Nexora"
        className={cn('size-9 rounded-xl bg-white object-contain p-1', logoClassName)}
      />
      <span className={cn('text-lg font-semibold tracking-tight', textClassName)}>Nexora</span>
    </span>
  );
}
