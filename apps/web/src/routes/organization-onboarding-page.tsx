import { Building2 } from 'lucide-react';

export function OrganizationOnboardingPage() {
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <span className="grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600">
          <Building2 aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
          Your account is not in an organization yet
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          A platform administrator creates organizations and assigns the first manager. If you were
          invited, ask them to send the invitation to this email address; it appears in the
          pending-invitation banner after you sign in.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          MyStock does not send invitation email. The person who invited you will share it with you
          directly.
        </p>
      </div>
    </div>
  );
}
