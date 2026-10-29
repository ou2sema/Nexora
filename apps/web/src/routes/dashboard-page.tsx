import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpFromLine, Boxes, LockKeyhole, Package, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';

import { useProducts } from '@/features/catalog/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { useStockSummary } from '@/features/stock/api';
import { useApiHealth } from '@/features/system/use-api-health';
import { cn } from '@/lib/cn';

function formatQuantity(value: number): string {
  return new Intl.NumberFormat('en-TN', { maximumFractionDigits: 4 }).format(value);
}

export function DashboardPage() {
  const health = useApiHealth();
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const products = useProducts(organizationId, {
    search: '',
    status: '',
    page: 1,
    pageSize: 1,
  });
  const stock = useStockSummary(organizationId);

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
      value: stock.data ? formatQuantity(stock.data.onHand) : '—',
      hint: stock.isError
        ? 'Stock summary failed'
        : `${stock.data?.locationCount ?? 0} stock lines across warehouses`,
    },
    {
      label: 'Reserved units',
      icon: LockKeyhole,
      value: stock.data ? formatQuantity(stock.data.reserved) : '—',
      hint: 'Active reservations hold availability, not physical stock',
    },
    {
      label: 'Available units',
      icon: ArrowUpFromLine,
      value: stock.data ? formatQuantity(stock.data.available) : '—',
      hint: 'On hand minus active reservations',
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
            void queryClient.invalidateQueries({ queryKey: ['organizations'] });
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

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-900">Stock ledger is live</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Balances above are projected from immutable, idempotent stock movements. Transfers,
          reservations and serialized devices are recorded with an audit trail; reconciliation can
          detect and repair projection drift without touching the ledger.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium">
          <Link to="/stock" className="text-indigo-700 hover:text-indigo-900">
            Open stock levels →
          </Link>
          <Link to="/stock/movements" className="text-indigo-700 hover:text-indigo-900">
            View movements →
          </Link>
          <Link to="/devices" className="text-indigo-700 hover:text-indigo-900">
            Devices →
          </Link>
        </div>
      </section>
    </div>
  );
}
