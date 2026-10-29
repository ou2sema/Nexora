import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
// Both classes are DI tokens at runtime, so these cannot be type-only imports.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';

import { AppError } from '../common/errors/app-error';
import type { AuthenticatedRequest } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SupabaseJwtService } from './supabase-jwt.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('unauthenticated', 'A bearer access token is required.', 401);
    }

    request.user = await this.jwt.verify(token);
    return true;
  }
}
