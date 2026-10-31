import { Controller, Get, Query } from '@nestjs/common';

import {
  type AdminAuditQuery,
  adminAuditQuerySchema,
  type AdminAuditResponse,
  type AdminOrganizationsResponse,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('organizations')
  listOrganizations(@CurrentUser() user: AuthenticatedUser): Promise<AdminOrganizationsResponse> {
    return this.admin.listOrganizations(user.id);
  }

  @Get('audit')
  listAudit(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(adminAuditQuerySchema)) query: AdminAuditQuery,
  ): Promise<AdminAuditResponse> {
    return this.admin.listAudit(user.id, query);
  }
}
