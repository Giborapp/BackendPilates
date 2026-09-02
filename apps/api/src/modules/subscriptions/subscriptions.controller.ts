import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { SimulateSubscriptionDto } from '@/shared/http/common.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing/subscription')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  @RequirePermissions('studio_settings.manage')
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.subscriptions.get(user.studioId);
  }

  @Patch('simulate')
  @RequirePermissions('studio_settings.manage')
  simulate(@CurrentUser() user: AuthenticatedUser, @Body() dto: SimulateSubscriptionDto) {
    return this.subscriptions.simulate(user, dto.status);
  }
}
