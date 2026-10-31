import { Button } from '@/components/ui/button';
import type { PluralBase } from '@/i18n/messages';
import { useI18n } from '@/i18n/provider';

interface PaginationFooterProps {
  total: number;
  page: number;
  pageCount: number;
  nounKey: PluralBase;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationFooter({
  total,
  page,
  pageCount,
  nounKey,
  onPrevious,
  onNext,
}: PaginationFooterProps) {
  const { t, plural } = useI18n();

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <p>
        {t('common.pagination.summary', {
          items: plural(nounKey, total),
          page,
          pageCount,
        })}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={onPrevious}>
          {t('common.previous')}
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={onNext}>
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
