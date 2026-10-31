import type { InvitationStatus, MemberRole } from '@mystock/contracts';

import type { MessageKey } from '@/i18n/messages';

export const roleKeys: Record<MemberRole, MessageKey> = {
  owner: 'common.role.owner',
  admin: 'common.role.admin',
  manager: 'common.role.manager',
  viewer: 'common.role.viewer',
};

export const invitationStatusKeys: Record<InvitationStatus, MessageKey> = {
  pending: 'common.invitationStatus.pending',
  expired: 'common.invitationStatus.expired',
  accepted: 'common.invitationStatus.accepted',
  revoked: 'common.invitationStatus.revoked',
};
