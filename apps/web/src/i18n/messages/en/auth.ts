export const auth = {
  'auth.signInTitle': 'Sign in',
  'auth.signUpTitle': 'Create your account',
  'auth.signInSubtitle': 'Use the email and password associated with your invitation.',
  'auth.signUpSubtitle': 'The first account can then create an organization.',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.haveAccount': 'Already have an account?',
  'auth.createOne': 'New account?',
  'auth.checkInbox': 'Check your inbox',
  'auth.confirmationSent': 'We sent a confirmation link to {email}. Confirm it, then sign in.',
  'auth.backToSignIn': 'Back to sign in',
  'auth.invalidEmail': 'Enter a valid email address',
  'auth.passwordTooShort': 'Use at least 8 characters',
  'auth.failed': 'Authentication failed.',
  'auth.skipToForm': 'Skip to sign-in form',
  'auth.emailPlaceholder': 'name@example.com',
  'auth.tagline': 'Clear flows, reliable stock.',
} as const;

export type AuthMessages = Record<keyof typeof auth, string>;
