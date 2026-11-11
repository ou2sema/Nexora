import { Printer } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { LabelRequest } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n/provider';
import { fieldClass } from '@/lib/form-field';
import { useDownloadLabels } from './api';

export interface LabelTarget {
  kind: 'product' | 'device' | 'item';
  id: string;
  title: string;
}

interface LabelDialogProps {
  organizationId: string;
  targets: LabelTarget[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/**
 * One sheet per request: product labels carry the GTIN when one exists and the
 * internal code otherwise; device labels always encode the serial number.
 */
export function LabelDialog({ organizationId, targets, open, onOpenChange }: LabelDialogProps) {
  const { t, plural, errorMessage } = useI18n();
  const mutation = useDownloadLabels(organizationId);
  const [copies, setCopies] = useState('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCopies('1');
      setError(null);
      mutation.reset();
    }
  }, [open]);

  const copyCount = Number(copies);
  const validCopies = Number.isInteger(copyCount) && copyCount >= 1 && copyCount <= 20;

  const generate = () => {
    if (!validCopies) {
      setError(t('scanLabels.copiesError'));
      return;
    }

    const items: LabelRequest['items'] = targets.map((target) =>
      target.kind === 'product'
        ? { kind: 'product', productId: target.id, copies: copyCount }
        : target.kind === 'device'
          ? { kind: 'device', deviceId: target.id, copies: copyCount }
          : { kind: 'item', itemId: target.id, copies: copyCount },
    );

    setError(null);
    mutation.mutate(
      { items },
      {
        onSuccess: (blob) => {
          saveBlob(blob, `nexora-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
          onOpenChange(false);
        },
        onError: (cause) => {
          setError(errorMessage(cause, 'scanLabels.failed'));
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t('scanLabels.title')}</DialogTitle>
        <DialogDescription>
          {t('scanLabels.description', {
            labels: plural('scanLabels.labels', targets.length),
          })}
        </DialogDescription>

        <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
          {targets.map((target) => (
            <li key={`${target.kind}-${target.id}`} className="flex justify-between gap-3">
              <span className="truncate">{target.title}</span>
              <span className="shrink-0 text-xs uppercase tracking-wide text-slate-500">
                {t(
                  target.kind === 'product'
                    ? 'scanLabels.kind.product'
                    : target.kind === 'device'
                      ? 'scanLabels.kind.device'
                      : 'scanLabels.kind.item',
                )}
              </span>
            </li>
          ))}
        </ul>

        <label htmlFor="label-copies" className="mt-4 block text-sm font-medium text-slate-700">
          {t('scanLabels.copies')}
          <input
            id="label-copies"
            type="number"
            min={1}
            max={20}
            value={copies}
            className={fieldClass}
            onChange={(event) => setCopies(event.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">{t('common.cancel')}</Button>
          </DialogClose>
          <Button disabled={mutation.isPending || !validCopies} onClick={generate}>
            <Printer aria-hidden="true" className="size-4" />
            {mutation.isPending ? t('scanLabels.generating') : t('scanLabels.download')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
