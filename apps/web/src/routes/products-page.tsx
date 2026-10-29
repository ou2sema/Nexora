import { PackagePlus } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ProductsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-600">
            Catalog of electronics, accessories and components.
          </p>
        </div>
        <Button disabled aria-describedby="products-phase-note">
          <PackagePlus aria-hidden="true" className="size-4" />
          Add product
        </Button>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">
            <PackagePlus aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-slate-900">No products yet</h2>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            Products, categories and brands are created here once the catalog schema and its tenant
            policies are in place.
          </p>
          <p id="products-phase-note" className="mt-4 text-xs font-medium text-slate-500">
            Product creation becomes available in Phase 2.
          </p>
        </div>
      </section>
    </div>
  );
}
