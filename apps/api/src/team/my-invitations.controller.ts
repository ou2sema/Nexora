import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { type MembershipSummary, type PendingInvitationsResponse } from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import type { InvitationIdParams } from './team.schemas';
import { invitationIdParamsSchema } from './team.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TeamService } from './team.service';

@Controller('me/invitations')
export class MyInvitationsController {
  constructor(private readonly team: TeamService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<PendingInvitationsResponse> {
    return this.team.listMyInvitations(user.id, user.email);
  }

  @Post(':invitationId/acceptance')
  @HttpCode(HttpStatus.OK)
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(invitationIdParamsSchema)) params: InvitationIdParams,
  ): Promise<MembershipSummary> {
    return this.team.acceptInvitation(user.id, user.email, params.invitationId);
  }
}
