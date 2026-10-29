import { MapPin, Plus, Warehouse } from 'lucide-react';
import { useState } from 'react';

import type { WarehouseSummary } from '@mystock/contracts';

import { Button } from '@/components/ui/button';
import { useWarehouses } from '@/features/catalog/api';
import { LocationFormDialog, WarehouseFormDialog } from '@/features/catalog/warehouse-forms';
import { useOrganization } from '@/features/organizations/organization-provider';

export function WarehousesPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.organizationId ?? null;
  const canWrite =
    organization?.role === 'owner' ||
    organization?.role === 'admin' ||
    organization?.role === 'manager';

  const warehouses = useWarehouses(organizationId);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [locationWarehouse, setLocationWarehouse] = useState<WarehouseSummary | null>(null);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Warehouses</h1>
          <p className="mt-1 text-sm text-slate-600">
            Physical sites and the storage locations stock will be counted against.
          </p>
        </div>
        <Button disabled={!canWrite} onClick={() => setWarehouseDialogOpen(true)}>
          <Plus aria-hidden="true" className="size-4" />
          Add warehouse
        </Button>
      </header>

      {!canWrite && (
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Your viewer role is read-only. Owners, admins and managers can change warehouses.
        </p>
      )}

      {warehouses.isError ? (
        <section className="rounded-xl border border-rose-200 bg-white p-6">
          <p role="alert" className="text-sm text-rose-700">
            {warehouses.error instanceof Error
              ? warehouses.error.message
              : 'Warehouses failed to load.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => void warehouses.refetch()}
          >
            Try again
          </Button>
        </section>
      ) : warehouses.isPending ? (
        <div className="grid gap-4 lg:grid-cols-2" role="status" aria-label="Loading warehouses">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={index}
              className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="h-5 w-1/2 rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : warehouses.data.length === 0 ? (
        <section className="flex flex-col items-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
            <Warehouse aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-slate-900">No warehouses yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            {canWrite
              ? 'Create the first physical site, then add its aisles or shelves as storage locations.'
              : 'An owner, admin or manager can create the first warehouse.'}
          </p>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {warehouses.data.map((warehouse) => (
            <section
              key={warehouse.id}
              aria-labelledby={`warehouse-${warehouse.id}`}
              className="rounded-xl border border-slate-200 bg-white"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      id={`warehouse-${warehouse.id}`}
                      className="text-base font-semibold text-slate-900"
                    >
                      {warehouse.name}
                    </h2>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
                      {warehouse.code}
                    </span>
                    {!warehouse.isActive && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin aria-hidden="true" className="size-4" />
                    {[warehouse.city, warehouse.countryCode].filter(Boolean).join(', ') ||
                      'No address recorded'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canWrite}
                  onClick={() => setLocationWarehouse(warehouse)}
                >
                  <Plus aria-hidden="true" className="size-4" />
                  Location
                </Button>
              </div>

              <div className="p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Storage locations
                </h3>
                {warehouse.locations.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-600">
                    No storage locations yet. Stock will need one when receiving.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {warehouse.locations.map((location) => (
                      <li
                        key={location.id}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="text-slate-700">{location.name}</span>
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {location.code}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {organizationId && (
        <>
          <WarehouseFormDialog
            organizationId={organizationId}
            open={warehouseDialogOpen}
            onOpenChange={setWarehouseDialogOpen}
          />
          {locationWarehouse && (
            <LocationFormDialog
              organizationId={organizationId}
              warehouse={locationWarehouse}
              open={Boolean(locationWarehouse)}
              onOpenChange={(open) => {
                if (!open) setLocationWarehouse(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
