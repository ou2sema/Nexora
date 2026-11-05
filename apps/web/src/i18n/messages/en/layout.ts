export const layout = {
  'layout.restoringSession': 'Restoring your session…',
  'layout.loadingWorkspace': 'Loading your workspace…',
  'layout.workspaceUnavailable': 'Workspace unavailable',
  'layout.notFound.title': 'Page not found',
  'layout.notFound.body': 'The page you are looking for does not exist or has moved.',
  'layout.notFound.back': 'Back to dashboard',
} as const;

export type LayoutMessages = Record<keyof typeof layout, string>;
