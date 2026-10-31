import { Module } from '@nestjs/common';

import { MyInvitationsController } from './my-invitations.controller';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  controllers: [TeamController, MyInvitationsController],
  providers: [TeamService],
})
export class TeamModule {}
