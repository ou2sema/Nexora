import type { InvitationStatus, MemberRole } from '@mystock/contracts';

export const roleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  viewer: 'Viewer',
};

export const invitationStatusLabels: Record<InvitationStatus, string> = {
  pending: 'Pending',
  expired: 'Expired',
  accepted: 'Accepted',
  revoked: 'Revoked',
};

export const dateOnly = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });

export const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDate(value: string): string {
  return dateOnly.format(new Date(value));
}

export function formatDateTime(value: string): string {
  return dateTime.format(new Date(value));
}
