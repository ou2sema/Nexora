import { Check } from 'lucide-react';

import type { MessageKey } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/lib/cn';

/** The three screens a phone counter moves through; a desk shows them at once. */
export type SaleStep = 'items' | 'payment' | 'done';

const STEPS: { id: SaleStep; labelKey: MessageKey }[] = [
  { id: 'items', labelKey: 'sale.step.items' },
  { id: 'payment', labelKey: 'sale.step.payment' },
  { id: 'done', labelKey: 'sale.step.done' },
];

export function SaleStepper({ current }: { current: SaleStep }) {
  const { t } = useI18n();
  const currentIndex = STEPS.findIndex((step) => step.id === current);

  return (
    <ol className="flex items-center gap-2" aria-label={t('sale.stepper.label')}>
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step.id}
            className="flex flex-1 items-center gap-2"
            aria-current={active ? 'step' : undefined}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                done && 'bg-emerald-600 text-white',
                active && 'bg-indigo-600 text-white',
                !done && !active && 'bg-slate-200 text-slate-500',
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn('text-xs font-medium', active ? 'text-slate-900' : 'text-slate-500')}
            >
              {t(step.labelKey)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
