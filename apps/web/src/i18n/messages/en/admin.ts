export const admin = {
  'admin.title': 'Administration',
  'admin.description':
    "Create organizations and manage membership across the platform. Business data stays scoped to each organization's members.",
  'admin.inviteMember': 'Invite member',
  'admin.newOrganization': 'New organization',
  'admin.organizationsHeading': 'Organizations',
  'admin.total': '{count} total',
  'admin.organizationsLoadFailed': 'Organizations failed to load.',
  'admin.loadingOrganizations': 'Loading organizations',
  'admin.emptyTitle': 'No organizations yet',
  'admin.emptyBody':
    'Create the first organization and optionally invite its first manager or viewer.',
  'admin.organizationsCaption': 'Organizations on this platform',
  'admin.membersColumn': 'Members',
  'admin.pendingInvitationsColumn': 'Pending invitations',
  'admin.createdColumn': 'Created',
  'admin.invite': 'Invite',
  'admin.manageTeam': 'Manage team',
  'admin.auditHeading': 'Operator activity',
  'admin.auditLoadFailed': 'Activity failed to load.',
  'admin.auditLoading': 'Loading activity…',
  'admin.auditEmpty':
    'No operator activity yet. Organization, invitation, and role changes made from administration are recorded here.',
  'admin.auditCaption': 'Recent platform administration activity',
  'admin.whenColumn': 'When',
  'admin.actionColumn': 'Action',
  'admin.targetColumn': 'Target',
  'admin.actorColumn': 'Actor',
  'admin.audit.action.organizationCreated': 'Created organization',
  'admin.audit.action.invitationCreated': 'Invited member',
  'admin.audit.action.invitationRevoked': 'Revoked invitation',
  'admin.audit.action.memberRoleChanged': 'Changed role',
  'admin.audit.action.memberRemoved': 'Removed member',
  'admin.audit.invitationDetail': '{role} invitation',
  'admin.audit.memberRemovedDetail': 'was {role}',
  'admin.createOrganizationDescription':
    'You become the owner. Optionally invite the first manager or viewer, choosing their role below.',
  'admin.footer':
    'Platform administration covers organizations, memberships and invitations. Stock, catalog, devices and orders require a membership in the relevant organization.',
  'adminTeam.organizationFallback': 'this organization',
  'adminInvite.title': 'Invite a member',
  'adminInvite.description':
    'Choose the organization and role. MyStock does not send email, so share the pending invitation with the person; it appears after they sign in with this address.',
  'adminInvite.organizationRequired': 'Choose an organization',
  'adminInvite.emailRequired': 'Enter an email address',
  'adminInvite.emailInvalid': 'Enter a valid email address',
  'adminInvite.roleLabel': 'Role',
  'adminInvite.ownershipNote':
    'Ownership is transferred by changing an existing member, not by invitation.',
  'adminInvite.createFailed': 'The invitation could not be created.',
  'adminInvite.sending': 'Sending…',
  'adminInvite.send': 'Send invitation',
} as const;

export type AdminMessages = Record<keyof typeof admin, string>;
