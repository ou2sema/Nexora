import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-provider';
import {
  OrganizationProvider,
  useOrganization,
} from '@/features/organizations/organization-provider';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { PendingInvitations } from '@/features/team/pending-invitations';
import { OrganizationOnboardingPage } from '@/routes/organization-onboarding-page';

export function AppShell() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <LoadingScreen label="Restoring your session…" />;
  }

  if (status === 'anonymous') {
    return (
      <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />
    );
  }

  return (
    <OrganizationProvider>
      <AuthenticatedShell />
    </OrganizationProvider>
  );
}

function AuthenticatedShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { memberships, isPending, error, refetch } = useOrganization();
  const { signOut } = useAuth();

  if (isPending) {
    return <LoadingScreen label="Loading your workspace…" />;
  }

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">Workspace unavailable</h1>
          <p role="alert" className="mt-2 text-sm text-slate-600">
            {error.message}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={refetch}>Try again</Button>
            <Button
              variant="secondary"
              onClick={() => {
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <Sidebar className="fixed inset-y-0 left-0 hidden w-64 lg:flex" />
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="lg:pl-64">
        <Topbar onOpenNav={() => setMobileNavOpen(true)} />
        <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <PendingInvitations />
          {memberships.length === 0 ? <OrganizationOnboardingPage /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}

function LoadingScreen({ label }: { label: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50" aria-live="polite">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <Loader2 aria-hidden="true" className="size-5 animate-spin text-indigo-600" />
        {label}
      </div>
    </main>
  );
}
