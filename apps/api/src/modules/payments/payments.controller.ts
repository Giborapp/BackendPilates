import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreatePaymentDto, IdParamDto, PaymentActionDto, PaymentQueryDto } from '@/shared/http/common.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermissions('payments.read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: PaymentQueryDto) {
    return this.payments.list(user, query);
  }

  @Post()
  @RequirePermissions('payments.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.payments.create(user, dto);
  }

  @Post(':id/pay')
  @RequirePermissions('payments.manage')
  pay(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.payments.pay(user, params.id, dto);
  }

  @Post(':id/waive')
  @RequirePermissions('payments.manage')
  waive(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.payments.waive(user, params.id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('payments.manage')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: PaymentActionDto) {
    return this.payments.cancel(user, params.id, dto);
  }

  @Patch(':id')
  @RequirePermissions('payments.manage')
  update(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: Partial<CreatePaymentDto>) {
    return this.payments.update(user, params.id, dto);
  }
}
