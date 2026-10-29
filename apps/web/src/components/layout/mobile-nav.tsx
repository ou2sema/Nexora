import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Sidebar } from '@/components/layout/sidebar';

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-2xl lg:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Main sections of the Mystock application.
          </Dialog.Description>
          <Dialog.Close
            aria-label="Close navigation"
            className="absolute right-3 top-5 z-10 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </Dialog.Close>
          <Sidebar onNavigate={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
