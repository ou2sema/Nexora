import { FileText, Loader2, Truck } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/provider';
import { saveBlob } from '@/lib/download';

import { useDownloadInvoicePdf, useDownloadIssueNotePdf } from './api';

interface InvoicePdfButtonsProps {
  organizationId: string;
  invoiceId: string;
}

/**
 * The two documents a counter sale hands over: the commercial invoice and the
 * bon de sortie. Both are rendered by the API from the stored invoice, so what
 * the customer keeps and what the warehouse keeps cannot disagree.
 */
export function InvoicePdfButtons({ organizationId, invoiceId }: InvoicePdfButtonsProps) {
  const { t, errorMessage } = useI18n();
  const downloadInvoice = useDownloadInvoicePdf(organizationId);
  const downloadIssueNote = useDownloadIssueNotePdf(organizationId);

  const [pending, setPending] = useState<'invoice' | 'issue' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (
    kind: 'invoice' | 'issue',
    request: (id: string) => Promise<{ blob: Blob; filename: string }>,
  ) => {
    setError(null);
    setNotice(null);
    setPending(kind);
    try {
      const file = await request(invoiceId);
      saveBlob(file.blob, file.filename);
      setNotice(t('invoice.detail.downloaded', { filename: file.filename }));
    } catch (cause) {
      setError(errorMessage(cause, 'invoice.detail.pdfFailed'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending !== null}
          onClick={() => void download('invoice', downloadInvoice)}
        >
          {pending === 'invoice' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FileText aria-hidden="true" className="size-4" />
          )}
          {t('invoice.detail.downloadInvoice')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending !== null}
          onClick={() => void download('issue', downloadIssueNote)}
        >
          {pending === 'issue' ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Truck aria-hidden="true" className="size-4" />
          )}
          {t('invoice.detail.downloadIssueNote')}
        </Button>
      </div>

      {notice && (
        <p role="status" className="text-xs text-emerald-700">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
