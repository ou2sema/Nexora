import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import type { ServerEnv } from '@mystock/config';

import { AppError } from '../common/errors/app-error';
import { SERVER_ENV } from '../config/env.tokens';
import type { AuthenticatedUser } from './authenticated-user';

const claimsSchema = z.object({
  sub: z.uuid(),
  email: z.string().optional(),
  role: z.string().optional(),
  session_id: z.string().optional(),
});

/** Verifies Supabase access tokens against the project's published JWKS. */
@Injectable()
export class SupabaseJwtService {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(SERVER_ENV) private readonly env: ServerEnv) {
    this.jwks = createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', env.SUPABASE_URL), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    let payload: unknown;
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.env.SUPABASE_JWT_ISSUER,
        audience: this.env.SUPABASE_JWT_AUDIENCE,
        algorithms: ['ES256', 'RS256'],
        requiredClaims: ['sub'],
      });
      payload = result.payload;
    } catch {
      throw new AppError('invalid_token', 'The access token is invalid or has expired.', 401);
    }

    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) {
      throw new AppError('invalid_token', 'The access token is invalid or has expired.', 401);
    }

    return {
      id: claims.data.sub,
      email: claims.data.email ?? null,
      supabaseRole: claims.data.role ?? null,
      sessionId: claims.data.session_id ?? null,
    };
  }
}
