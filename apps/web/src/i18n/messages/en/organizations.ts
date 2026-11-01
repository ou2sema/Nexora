export const organizations = {
  'organizations.label': 'Organization',
  'organizations.none': 'No organization',
  'organizations.createAction': 'Create organization',
  'organizations.newShort': 'New org',
  'organizations.createTitle': 'Create organization',
  'organizations.createDescription':
    'You become the owner. The slug is derived from the name and must be unique.',
  'organizations.onboarding.title': 'Your account is not in an organization yet',
  'organizations.onboarding.body':
    'A platform administrator creates organizations and assigns the first manager. If you were invited, ask them to send the invitation to this email address; it appears in the pending-invitation banner after you sign in.',
  'organizations.onboarding.note':
    'Nexora does not send invitation email. The person who invited you will share it with you directly.',
  'organizations.form.name': 'Organization name',
  'organizations.form.nameRequired': 'Enter an organization name',
  'organizations.form.slugHint': 'A URL-friendly slug is derived from the name.',
  'organizations.form.firstMember': 'First member',
  'organizations.form.firstMemberHint':
    'Optional. You become the owner; this person receives an invitation for the selected role.',
  'organizations.form.email': 'Email',
  'organizations.form.invalidEmail': 'Enter a valid email address',
  'organizations.form.role': 'Role',
  'organizations.form.create': 'Create organization',
  'organizations.form.creating': 'Creating…',
  'organizations.form.failed': 'The organization could not be created.',
} as const;

export type OrganizationsMessages = Record<keyof typeof organizations, string>;
