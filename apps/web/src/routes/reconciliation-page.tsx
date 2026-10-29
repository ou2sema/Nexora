import { RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useRepairStockBalances, useStockReconciliation } from '@/features/stock/api';
import { cn } from '@/lib/cn';

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 4 }).format(value);
}

export function ReconciliationPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const reconciliation = useStockReconciliation(organizationId, canWrite);
  const repair = useRepairStockBalances(organizationId ?? '');
  const [confirmApply, setConfirmApply] = useState(false);

  const rows = reconciliation.data ?? [];
  const drift = rows.filter((row) => row.difference !== 0);

  const repairError = repair.error instanceof Error ? repair.error.message : null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reconciliation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Compare the derived balance projection with the append-only ledger and repair drift
            safely.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!canWrite || reconciliation.isFetching}
            onClick={() => void reconciliation.refetch()}
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-4', reconciliation.isFetching && 'animate-spin')}
            />
            Run check
          </Button>
          <Button
            variant="secondary"
            disabled={!canWrite || repair.isPending}
            onClick={() => void repair.mutateAsync(true).catch(() => undefined)}
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            Dry run repair
          </Button>
          <Button
            disabled={!canWrite || repair.isPending || drift.length === 0}
            onClick={() => setConfirmApply(true)}
          >
            <Wrench aria-hidden="true" className="size-4" />
            Apply repair
          </Button>
        </div>
      </header>

      {!canWrite ? (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Reconciliation is restricted to owners, admins and managers.
        </p>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              {reconciliation.isPending
                ? 'Checking the ledger…'
                : drift.length === 0
                  ? 'Ledger and balances agree'
                  : `${drift.length} stock line${drift.length === 1 ? '' : 's'} out of balance`}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Every stock line is recomputed from its posted movements. A difference appears only if
              a projection was changed outside the ledger — repair rewrites the projection, never
              the ledger.
            </p>
          </section>

          {repairError && (
            <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {repairError}
            </p>
          )}

          {reconciliation.isError ? (
            <section className="rounded-xl border border-rose-200 bg-white p-6">
              <p role="alert" className="text-sm text-rose-700">
                {reconciliation.error instanceof Error
                  ? reconciliation.error.message
                  : 'Reconciliation failed to run.'}
              </p>
            </section>
          ) : reconciliation.isPending ? (
            <div
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
              role="status"
              aria-label="Running reconciliation"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-4 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
              <p className="text-sm text-slate-600">
                No stock lines yet. Post a receipt to create the first balance.
              </p>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Stock balance reconciliation</caption>
                  <thead className="text-xs uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Product
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Location
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Balance
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Ledger
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Difference
                      </th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">
                        Movements
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={`${row.productId}-${row.warehouseId}-${row.locationId}`}
                        className={cn(
                          'hover:bg-slate-50',
                          row.difference !== 0 && 'bg-amber-50/60',
                        )}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.productName}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-500">
                            {row.productSku}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {row.warehouseCode} / {row.locationCode}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatQuantity(row.balanceOnHand)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatQuantity(row.ledgerOnHand)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right font-medium tabular-nums',
                            row.difference === 0 ? 'text-emerald-700' : 'text-rose-700',
                          )}
                        >
                          {row.difference > 0 ? '+' : ''}
                          {formatQuantity(row.difference)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {row.movementCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {repair.data && (
            <section className="rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Repair result · {repair.data.some((row) => row.repaired) ? 'applied' : 'dry run'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {repair.data.length === 0
                    ? 'No projection drift was found; nothing needed repair.'
                    : 'Only balance projections were rewritten. Ledger movements are untouched.'}
                </p>
              </div>
              {repair.data.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Stock projection repair result</caption>
                    <thead className="text-xs uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Product
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Location
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">
                          Previous
                        </th>
                        <th scope="col" className="px-4 py-3 text-right font-semibold">
                          Ledger
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                          Applied
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {repair.data.map((row) => (
                        <tr key={`${row.productId}-${row.warehouseId}-${row.locationId}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{row.productName}</p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              {row.productSku}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">
                            {row.warehouseCode} / {row.locationCode}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {formatQuantity(row.previousOnHand)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                            {formatQuantity(row.ledgerOnHand)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                row.repaired
                                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                  : 'bg-slate-100 text-slate-700 ring-slate-200',
                              )}
                            >
                              {row.repaired ? 'Repaired' : 'Dry run'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent>
          <DialogTitle>Apply projection repair</DialogTitle>
          <DialogDescription>
            This rewrites {drift.length} balance projection{drift.length === 1 ? '' : 's'} to match
            the ledger. Ledger movements are immutable and will not change.
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              disabled={repair.isPending}
              onClick={async () => {
                try {
                  await repair.mutateAsync(false);
                  setConfirmApply(false);
                } catch {
                  // repair.error renders on the page.
                }
              }}
            >
              {repair.isPending ? 'Repairing…' : 'Apply repair'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
