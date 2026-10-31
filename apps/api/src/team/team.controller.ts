import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import {
  type ChangeMemberRoleInput,
  changeMemberRoleSchema,
  type CreateInvitationInput,
  createInvitationSchema,
  type InvitationListResponse,
  type InvitationSummary,
  type TeamMemberSummary,
  type TeamMembersResponse,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  type InvitationParams,
  invitationParamsSchema,
  type MemberParams,
  memberParamsSchema,
  type OrganizationParams,
  organizationParamsSchema,
} from './team.schemas';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { TeamService } from './team.service';

@Controller('organizations/:organizationId')
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get('members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<TeamMembersResponse> {
    return this.team.listMembers(user.id, params.organizationId);
  }

  @Patch('members/:userId')
  changeRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(memberParamsSchema)) params: MemberParams,
    @Body(new ZodValidationPipe(changeMemberRoleSchema)) input: ChangeMemberRoleInput,
  ): Promise<TeamMemberSummary> {
    return this.team.changeMemberRole(user.id, params.organizationId, params.userId, input.role);
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(memberParamsSchema)) params: MemberParams,
  ): Promise<void> {
    return this.team.removeMember(user.id, params.organizationId, params.userId);
  }

  @Get('invitations')
  listInvitations(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
  ): Promise<InvitationListResponse> {
    return this.team.listInvitations(user.id, params.organizationId);
  }

  @Post('invitations')
  createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Body(new ZodValidationPipe(createInvitationSchema)) input: CreateInvitationInput,
  ): Promise<InvitationSummary> {
    return this.team.createInvitation(user.id, params.organizationId, input.email, input.role);
  }

  @Post('invitations/:invitationId/revocation')
  @HttpCode(HttpStatus.OK)
  revokeInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(invitationParamsSchema)) params: InvitationParams,
  ): Promise<InvitationSummary> {
    return this.team.revokeInvitation(user.id, params.organizationId, params.invitationId);
  }
}
