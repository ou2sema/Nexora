import type { MemberRole } from '@mystock/contracts';

/**
 * The three workspaces the web app tailors itself to. Roles keep their existing
 * write authority; this only decides which landing page and navigation a member sees.
 */
export type Workspace = 'owner' | 'manager' | 'counter';

export interface Capabilities {
  workspace: Workspace;
  canWrite: boolean;
  canManageTeam: boolean;
}

export function capabilitiesFor(role: MemberRole | null | undefined): Capabilities {
  const workspace: Workspace =
    role === 'owner' || role === 'admin' ? 'owner' : role === 'manager' ? 'manager' : 'counter';

  return {
    workspace,
    canWrite: workspace !== 'counter',
    canManageTeam: workspace === 'owner',
  };
}
