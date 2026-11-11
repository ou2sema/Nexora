import { CounterLanding } from '@/features/dashboard/counter-landing';
import { ManagerDashboard } from '@/features/dashboard/manager-dashboard';
import { OwnerDashboard } from '@/features/dashboard/owner-dashboard';
import { useOrganization } from '@/features/organizations/organization-provider';
import { capabilitiesFor } from '@/features/organizations/permissions';

export function DashboardPage() {
  const { organization, memberships } = useOrganization();
  const { workspace } = capabilitiesFor(organization?.role ?? memberships[0]?.role);

  if (workspace === 'manager') {
    return <ManagerDashboard />;
  }

  if (workspace === 'counter') {
    return <CounterLanding />;
  }

  return <OwnerDashboard />;
}
