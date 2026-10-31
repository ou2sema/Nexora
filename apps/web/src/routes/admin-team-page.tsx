import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';

import { useAdminOrganizations } from '@/features/admin/api';
import { useOrganization } from '@/features/organizations/organization-provider';
import { TeamView } from '@/routes/team-page';

export function AdminTeamPage() {
  const { platformAdmin } = useOrganization();
  const { organizationId } = useParams<{ organizationId: string }>();
  const organizations = useAdminOrganizations();

  if (!platformAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!organizationId) {
    return <Navigate to="/admin" replace />;
  }

  const organization = organizations.data?.items.find((item) => item.id === organizationId);

  return (
    <div className="space-y-4">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Administration
      </Link>
      <TeamView
        organizationId={organizationId}
        organizationName={organization?.name ?? 'this organization'}
        role={null}
        platformAdmin
      />
    </div>
  );
}
