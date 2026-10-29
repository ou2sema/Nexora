import { Module } from '@nestjs/common';

import { MeController } from './me.controller';
import { OrganizationsController } from './organizations.controller';

@Module({
  controllers: [MeController, OrganizationsController],
})
export class AccountModule {}
