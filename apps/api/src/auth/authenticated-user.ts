import type { RequestWithId } from '../common/http/request-id';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  supabaseRole: string | null;
  sessionId: string | null;
}

export type AuthenticatedRequest = RequestWithId & { user?: AuthenticatedUser };
