import { Menu } from 'lucide-react';

interface TopbarProps {
  onOpenNav: () => void;
}

export function Topbar({ onOpenNav }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div className="flex-1">
        <p className="text-sm font-medium text-slate-500">Electronics inventory</p>
      </div>

      <span className="hidden rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 sm:inline">
        Development
      </span>

      <div className="grid size-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
        <span className="sr-only">Signed in as</span>
        MS
      </div>
    </header>
  );
}
