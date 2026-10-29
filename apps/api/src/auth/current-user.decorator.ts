import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { AppError } from '../common/errors/app-error';
import type { AuthenticatedRequest, AuthenticatedUser } from './authenticated-user';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.user) {
    throw new AppError('unauthenticated', 'Authentication is required.', 401);
  }
  return request.user as AuthenticatedUser;
});
