import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateBookingDto, IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.classBooking.findMany({ where: { studioId: user.studioId }, include: { student: true, classSession: true } });
  }

  @Post()
  @RequirePermissions('classes.update')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    const booking = await this.prisma.$transaction(async (tx) => {
      const [session, settings] = await Promise.all([
        tx.classSession.findFirstOrThrow({ where: { id: dto.classSessionId, studioId: user.studioId } }),
        tx.studioSettings.findUniqueOrThrow({ where: { studioId: user.studioId } }),
      ]);
      await tx.student.findFirstOrThrow({ where: { id: dto.studentId, studioId: user.studioId, archivedAt: null } });
      if (dto.bookingType === BookingType.REPLACEMENT && dto.replacementCreditId) {
        await tx.replacementCredit.findFirstOrThrow({ where: { id: dto.replacementCreditId, studioId: user.studioId, studentId: dto.studentId, status: 'AVAILABLE' } });
      }
      const consumesCapacity = dto.bookingType !== BookingType.TRIAL || settings.trialClassOccupiesCapacity;
      if (consumesCapacity) {
        const occupied = await tx.classBooking.count({ where: { studioId: user.studioId, classSessionId: session.id, status: { in: [BookingStatus.BOOKED, BookingStatus.COMPLETED] }, OR: settings.trialClassOccupiesCapacity ? undefined : [{ bookingType: { not: BookingType.TRIAL } }] } });
        if (occupied >= session.capacity) {
          if (!settings.allowOverbooking || !dto.allowOverbooking || !(user.role === 'ADMIN' || user.permissions.includes('capacity.override'))) {
            throw new BadRequestException('Class capacity exceeded');
          }
          await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'capacity.override', entityType: 'ClassSession', entityId: session.id, metadata: { occupied, capacity: session.capacity } });
        }
      }
      const created = await tx.classBooking.create({ data: { studioId: user.studioId, classSessionId: session.id, studentId: dto.studentId, bookingType: dto.bookingType, replacementCreditId: dto.replacementCreditId, createdByStaffId: user.staffMemberId } });
      if (dto.replacementCreditId) {
        await tx.replacementCredit.update({ where: { id: dto.replacementCreditId }, data: { status: 'USED', usedAt: new Date(), usedBookingId: created.id } });
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'bookings.create', entityType: 'ClassBooking', entityId: booking.id, after: booking });
    return booking;
  }

  @Post(':id/cancel')
  @RequirePermissions('classes.update')
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto) {
    const booking = await this.prisma.classBooking.update({ where: { id: params.id, studioId: user.studioId }, data: { status: BookingStatus.CANCELLED } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'bookings.cancel', entityType: 'ClassBooking', entityId: booking.id });
    return booking;
  }
}
