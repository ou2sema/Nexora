import { useState } from 'react';

import { useWarehouses } from '@/features/catalog/api';
import { Button } from '@/components/ui/button';
import { CounterSale } from '@/features/invoicing/counter-sale';
import { InvoiceDetailDialog } from '@/features/invoicing/invoice-detail-dialog';
import { RecentInvoices } from '@/features/invoicing/recent-invoices';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useI18n } from '@/i18n/provider';

export function CounterSalePage() {
  const { t } = useI18n();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const warehouses = useWarehouses(organizationId);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  // The counter owns the screen while it is worked; the invoices it posted are the
  // memory, opened when the operator wants to settle or reprint one.
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t('sale.title')}
          </h1>
          <p className="mt-1 hidden text-sm text-slate-600 sm:block">{t('sale.description')}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}
        >
          {t('sale.history.action')}
        </Button>
      </header>

      {organizationId && (
        <>
          <CounterSale
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            canWrite={canWrite}
            onOpenInvoice={setSelectedInvoiceId}
          />
          {historyOpen && (
            <RecentInvoices
              organizationId={organizationId}
              canWrite={canWrite}
              onOpenInvoice={setSelectedInvoiceId}
            />
          )}
          <InvoiceDetailDialog
            organizationId={organizationId}
            invoiceId={selectedInvoiceId}
            canWrite={canWrite}
            onOpenChange={(open) => {
              if (!open) setSelectedInvoiceId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
