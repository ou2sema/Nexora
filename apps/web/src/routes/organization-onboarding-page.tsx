import { Building2 } from 'lucide-react';

import { CreateOrganizationForm } from '@/features/organizations/create-organization-form';

export function OrganizationOnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <span className="grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600">
          <Building2 aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
          Create your first organization
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Products, warehouses and stock movements are scoped to an organization. You will be its
          first owner and can invite the rest of the team later.
        </p>
        <div className="mt-6">
          <CreateOrganizationForm />
        </div>
      </div>
    </div>
  );
}
