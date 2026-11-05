import { useState } from 'react';

import { useWarehouses } from '@/features/catalog/api';
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t('sale.title')}</h1>
        <p className="mt-1 hidden text-sm text-slate-600 sm:block">{t('sale.description')}</p>
      </header>

      {organizationId && (
        <>
          <CounterSale
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            canWrite={canWrite}
            onOpenInvoice={setSelectedInvoiceId}
          />
          <RecentInvoices
            organizationId={organizationId}
            canWrite={canWrite}
            onOpenInvoice={setSelectedInvoiceId}
          />
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
