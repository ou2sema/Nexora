import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import {
  type DeviceEventSummary,
  type DeviceListQuery,
  type DeviceListResponse,
  type DeviceMoveInput,
  type DeviceMoveResult,
  type DeviceRegisterInput,
  type DeviceRegistrationResult,
  type DeviceStatusChangeInput,
  type DeviceStatusChangeResult,
  type DeviceSummary,
  deviceListQuerySchema,
  deviceMoveSchema,
  deviceRegisterSchema,
  deviceStatusChangeSchema,
} from '@mystock/contracts';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
// The class is a DI token at runtime, so this cannot be a type-only import.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DevicesService } from './devices.service';
import {
  type DeviceParams,
  deviceParamsSchema,
  type OrganizationParams,
  organizationParamsSchema,
} from './devices.schemas';

@Controller('organizations/:organizationId/devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Query(new ZodValidationPipe(deviceListQuerySchema)) query: DeviceListQuery,
  ): Promise<DeviceListResponse> {
    return this.devices.list(user.id, params.organizationId, query);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(organizationParamsSchema)) params: OrganizationParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(deviceRegisterSchema)) input: DeviceRegisterInput,
  ): Promise<DeviceRegistrationResult> {
    return this.devices.register(user.id, params.organizationId, idempotencyKey, input);
  }

  @Get(':deviceId')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
  ): Promise<DeviceSummary> {
    return this.devices.get(user.id, params.organizationId, params.deviceId);
  }

  @Get(':deviceId/events')
  events(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
  ): Promise<DeviceEventSummary[]> {
    return this.devices.events(user.id, params.organizationId, params.deviceId);
  }

  @Post(':deviceId/status')
  @HttpCode(HttpStatus.OK)
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(deviceStatusChangeSchema)) input: DeviceStatusChangeInput,
  ): Promise<DeviceStatusChangeResult> {
    return this.devices.changeStatus(
      user.id,
      params.organizationId,
      params.deviceId,
      idempotencyKey,
      input,
    );
  }

  @Post(':deviceId/location')
  @HttpCode(HttpStatus.OK)
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param(new ZodValidationPipe(deviceParamsSchema)) params: DeviceParams,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body(new ZodValidationPipe(deviceMoveSchema)) input: DeviceMoveInput,
  ): Promise<DeviceMoveResult> {
    return this.devices.move(
      user.id,
      params.organizationId,
      params.deviceId,
      idempotencyKey,
      input,
    );
  }
}
