import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateBookingDto, IdParamDto } from '@/shared/http/common.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.bookings.list(user.studioId);
  }

  @Post()
  @RequirePermissions('classes.update')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('classes.update')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    return this.bookings.cancel(user, params.id);
  }
}
