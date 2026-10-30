import { Printer, Search, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { DeviceStatus } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { PaginationFooter } from '@/components/ui/pagination-footer';
import { useProducts, useWarehouses } from '@/features/catalog/api';
import { useDevices } from '@/features/devices/api';
import { DeviceDetailDialog, RegisterDeviceDialog } from '@/features/devices/device-dialogs';
import {
  deviceConditionLabels,
  deviceStatusLabels,
  deviceStatusStyles,
} from '@/features/devices/labels';
import { useOrganization } from '@/features/organizations/organization-provider';
import { LabelDialog, type LabelTarget } from '@/features/scanning/label-dialog';
import { cn } from '@/lib/cn';

const PAGE_SIZE = 25;

function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function DevicesPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeviceStatus | ''>('');
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [labelTargets, setLabelTargets] = useState<LabelTarget[] | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const devices = useDevices(organizationId, {
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const warehouses = useWarehouses(organizationId);
  const products = useProducts(organizationId, {
    search: '',
    status: 'active',
    page: 1,
    pageSize: 100,
  });

  const total = devices.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Devices</h1>
          <p className="mt-1 text-sm text-slate-600">
            Serialized units with unique serial numbers, IMEI checks and an append-only lifecycle.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={() => setRegisterOpen(true)}>
          <Smartphone aria-hidden="true" className="size-4" />
          Register device
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers can register and move devices.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor="device-search" className="sr-only">
              Search devices
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="device-search"
              type="search"
              value={search}
              placeholder="Search by serial, IMEI or product"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div>
            <label htmlFor="device-status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="device-status-filter"
              value={status}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500"
              onChange={(event) => {
                setStatus(event.target.value as DeviceStatus | '');
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {(Object.keys(deviceStatusLabels) as DeviceStatus[]).map((option) => (
                <option key={option} value={option}>
                  {deviceStatusLabels[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {devices.isError ? (
          <div className="p-6">
            <p role="alert" className="text-sm text-rose-700">
              {devices.error instanceof Error ? devices.error.message : 'Devices failed to load.'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => void devices.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : devices.isPending ? (
          <div className="divide-y divide-slate-100" role="status" aria-label="Loading devices">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex animate-pulse items-center gap-4 px-4 py-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
                <div className="h-4 w-1/6 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
              <Smartphone aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-slate-900">
              {search || status ? 'No matching devices' : 'No devices registered'}
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-600">
              {search || status
                ? 'Adjust the search or status filter to see more results.'
                : canWrite
                  ? 'Register the first serialized unit to start a traceable history.'
                  : 'An owner, admin or manager can register the first device.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Registered serialized devices</caption>
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Serial
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Product
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Condition
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Location
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">
                    History
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.data.items.map((device) => (
                  <tr key={device.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-slate-900">
                        {device.serialNumber}
                      </p>
                      {device.imei && (
                        <p className="mt-0.5 font-mono text-xs text-slate-500">{device.imei}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{device.productName}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{device.productSku}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                          deviceStatusStyles[device.status],
                        )}
                      >
                        {deviceStatusLabels[device.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {deviceConditionLabels[device.condition]}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {device.warehouseCode} / {device.locationCode}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setLabelTargets([
                              {
                                kind: 'device',
                                id: device.id,
                                title: `${device.serialNumber} — ${device.productName}`,
                              },
                            ])
                          }
                        >
                          <Printer aria-hidden="true" className="size-4" />
                          Label
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedDeviceId(device.id)}
                        >
                          Open
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <PaginationFooter
            total={total}
            page={page}
            pageCount={pageCount}
            noun="device"
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      {organizationId && labelTargets && (
        <LabelDialog
          organizationId={organizationId}
          targets={labelTargets}
          open={Boolean(labelTargets)}
          onOpenChange={(open) => {
            if (!open) setLabelTargets(null);
          }}
        />
      )}

      {organizationId && (
        <>
          <RegisterDeviceDialog
            organizationId={organizationId}
            warehouses={warehouses.data ?? []}
            products={products.data?.items ?? []}
            open={registerOpen}
            onOpenChange={setRegisterOpen}
          />
          <DeviceDetailDialog
            organizationId={organizationId}
            deviceId={selectedDeviceId}
            warehouses={warehouses.data ?? []}
            canWrite={canWrite}
            onOpenChange={(open) => {
              if (!open) setSelectedDeviceId(null);
            }}
          />
        </>
      )}
    </div>
  );
}
