import { Button } from '@/components/ui/button';

interface PaginationFooterProps {
  total: number;
  page: number;
  pageCount: number;
  noun: string;
  onPrevious: () => void;
  onNext: () => void;
}

export function PaginationFooter({
  total,
  page,
  pageCount,
  noun,
  onPrevious,
  onNext,
}: PaginationFooterProps) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <p>
        {total} {noun}
        {total === 1 ? '' : 's'} · page {page} of {pageCount}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={onPrevious}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
