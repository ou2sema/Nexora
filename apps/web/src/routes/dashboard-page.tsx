import { useQueryClient } from '@tanstack/react-query';
import { Boxes, CircleDollarSign, LockKeyhole, Package, RefreshCw } from 'lucide-react';

import { useProducts } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useApiHealth } from '@/features/system/use-api-health';
import { cn } from '@/lib/cn';

export function DashboardPage() {
  const health = useApiHealth();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const products = useProducts(organization?.organizationId ?? null, {
    search: '',
    status: '',
    page: 1,
    pageSize: 1,
  });

  const status = health.isPending
    ? { tone: 'pending', label: 'Checking API…' }
    : health.isError
      ? { tone: 'error', label: 'API unreachable' }
      : { tone: 'ok', label: 'API online' };

  const metrics = [
    {
      label: 'Distinct products',
      icon: Package,
      value: products.data ? String(products.data.total) : '—',
      hint: products.isError ? 'Catalog query failed' : 'Active and archived catalog entries',
    },
    {
      label: 'Units on hand',
      icon: Boxes,
      value: '—',
      hint: 'Derived from the stock ledger in Phase 3',
    },
    {
      label: 'Reserved units',
      icon: LockKeyhole,
      value: '—',
      hint: 'Reservations arrive in Phase 3',
    },
    {
      label: 'Inventory value',
      icon: CircleDollarSign,
      value: '—',
      hint: 'Valued from posted movements in Phase 5',
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">
          Operational overview of stock, devices and movement activity.
        </p>
      </header>

      <section
        aria-labelledby="api-status-heading"
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'mt-1 size-2.5 rounded-full',
              status.tone === 'ok' && 'bg-emerald-500',
              status.tone === 'pending' && 'bg-slate-300',
              status.tone === 'error' && 'bg-rose-500',
            )}
          />
          <div>
            <h2 id="api-status-heading" className="text-sm font-semibold text-slate-900">
              {status.label}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {health.data
                ? `${health.data.service} · up ${health.data.uptimeSeconds}s`
                : health.isError
                  ? 'Start the API with: npm run dev --workspace @mystock/api'
                  : 'Contacting the health endpoint…'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['system', 'health'] });
            void products.refetch();
          }}
          className="inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 sm:self-auto"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Refresh
        </button>
      </section>

      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Inventory metrics
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5">
              <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <metric.icon aria-hidden="true" className="size-4 text-slate-400" />
                {metric.label}
              </dt>
              <dd
                className={cn(
                  'mt-3 text-3xl font-semibold tabular-nums',
                  metric.value === '—' ? 'text-slate-400' : 'text-slate-900',
                )}
              >
                {metric.value}
              </dd>
              <p className="mt-2 text-xs text-slate-500">{metric.hint}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-dashed border-slate-300 bg-white/60 p-6">
        <h2 className="text-sm font-semibold text-slate-900">
          Stock metrics arrive with the ledger
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Products are now read from PostgreSQL under organization row-level security. Units,
          reservations and valuation stay empty until the immutable stock ledger lands in Phase 3 —
          no placeholder numbers are shown.
        </p>
      </section>
    </div>
  );
}
