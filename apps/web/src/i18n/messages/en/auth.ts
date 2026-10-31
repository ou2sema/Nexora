export const auth = {
  'auth.signInTitle': 'Sign in',
  'auth.signUpTitle': 'Create your account',
  'auth.signInSubtitle': 'Use the email and password associated with your invitation.',
  'auth.signUpSubtitle': 'The first account can then create an organization.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.noAccount': 'No account yet?',
  'auth.haveAccount': 'Already have an account?',
  'auth.createOne': 'Create one',
  'auth.checkInbox': 'Check your inbox',
  'auth.confirmationSent': 'We sent a confirmation link to {email}. Confirm it, then sign in.',
  'auth.backToSignIn': 'Back to sign in',
  'auth.invalidEmail': 'Enter a valid email address',
  'auth.passwordTooShort': 'Use at least 8 characters',
  'auth.failed': 'Authentication failed.',
  'auth.skipToForm': 'Skip to sign-in form',
  'auth.tagline': 'Electronics inventory you can audit.',
  'auth.taglineBody':
    'Multi-warehouse stock, serialized devices and TND valuation — all derived from an append-only ledger.',
  'auth.pointTenancy': 'Organization-isolated data enforced in the database, not just the UI.',
  'auth.pointAudit': 'Every stock change traceable to an actor, reason and document.',
  'auth.footer': 'Tunisian dinar · Multi-warehouse inventory · Phase 12',
} as const;

export type AuthMessages = Record<keyof typeof auth, string>;
