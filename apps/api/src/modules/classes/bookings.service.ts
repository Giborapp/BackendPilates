import { BadRequestException, Injectable } from '@nestjs/common';
import { BookingStatus, BookingType, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateBookingDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(studioId: string) {
    return this.prisma.classBooking.findMany({
      where: { studioId },
      include: { student: true, classSession: true, attendance: true },
    });
  }

  async create(user: AuthenticatedUser, dto: CreateBookingDto) {
    const booking = await this.prisma.$transaction(
      async (tx) => {
        const [session, settings] = await Promise.all([
          tx.classSession.findFirstOrThrow({
            where: { id: dto.classSessionId, studioId: user.studioId },
          }),
          tx.studioSettings.findUniqueOrThrow({ where: { studioId: user.studioId } }),
        ]);
        await tx.student.findFirstOrThrow({
          where: { id: dto.studentId, studioId: user.studioId, archivedAt: null },
        });
        if (dto.bookingType === BookingType.REPLACEMENT && dto.replacementCreditId) {
          await tx.replacementCredit.findFirstOrThrow({
            where: {
              id: dto.replacementCreditId,
              studioId: user.studioId,
              studentId: dto.studentId,
              status: 'AVAILABLE',
            },
          });
        }
        const consumesCapacity =
          dto.bookingType !== BookingType.TRIAL || settings.trialClassOccupiesCapacity;
        if (consumesCapacity) {
          const occupied = await tx.classBooking.count({
            where: {
              studioId: user.studioId,
              classSessionId: session.id,
              status: { in: [BookingStatus.BOOKED, BookingStatus.COMPLETED] },
              OR: settings.trialClassOccupiesCapacity
                ? undefined
                : [{ bookingType: { not: BookingType.TRIAL } }],
            },
          });
          if (occupied >= session.capacity) {
            if (
              !settings.allowOverbooking ||
              !dto.allowOverbooking ||
              !(user.role === 'ADMIN' || user.permissions.includes('capacity.override'))
            ) {
              throw new BadRequestException('Class capacity exceeded');
            }
            await this.audit.record({
              studioId: user.studioId,
              actorStaffId: user.staffMemberId,
              action: 'capacity.override',
              entityType: 'ClassSession',
              entityId: session.id,
              metadata: { occupied, capacity: session.capacity },
            });
          }
        }
        const created = await tx.classBooking.create({
          data: {
            studioId: user.studioId,
            classSessionId: session.id,
            studentId: dto.studentId,
            bookingType: dto.bookingType,
            replacementCreditId: dto.replacementCreditId,
            createdByStaffId: user.staffMemberId,
          },
        });
        if (dto.replacementCreditId) {
          await tx.replacementCredit.update({
            where: { id: dto.replacementCreditId },
            data: { status: 'RESERVED', usedBookingId: created.id },
          });
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'bookings.create',
      entityType: 'ClassBooking',
      entityId: booking.id,
      after: booking,
    });
    return booking;
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const booking = await this.prisma.$transaction(async (tx) => {
      const current = await tx.classBooking.findFirstOrThrow({ where: { id, studioId: user.studioId } });
      const updated = await tx.classBooking.update({ where: { id: current.id }, data: { status: BookingStatus.CANCELLED } });
      if (current.replacementCreditId) {
        await tx.replacementCredit.updateMany({ where: { id: current.replacementCreditId, studioId: user.studioId, status: 'RESERVED', expiresAt: { gt: new Date() } }, data: { status: 'AVAILABLE', usedBookingId: null } });
      }
      return updated;
    });
    await this.audit.record({
      studioId: user.studioId,
      actorStaffId: user.staffMemberId,
      action: 'bookings.cancel',
      entityType: 'ClassBooking',
      entityId: booking.id,
    });
    return booking;
  }
}
