import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, BookingType, Prisma, PublicReplacementLinkStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AppConfigService } from '@/shared/config/app-config.service';
import { CreateReplacementLinkDto, ReserveReplacementDto } from './replacement-links.dto';

@Injectable()
export class ReplacementLinksService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly config: AppConfigService) {}

  async create(user: AuthenticatedUser, dto: CreateReplacementLinkDto) {
    const credit = await this.prisma.replacementCredit.findFirstOrThrow({ where: { id: dto.replacementCreditId, studioId: user.studioId, status: 'AVAILABLE', expiresAt: { gt: new Date() } } });
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Math.min(credit.expiresAt.getTime(), Date.now() + 7 * 86_400_000));
    const link = await this.prisma.publicReplacementLink.upsert({ where: { replacementCreditId: credit.id }, update: { tokenHash: hash(token), status: PublicReplacementLinkStatus.OPEN, expiresAt, revokedAt: null, usedAt: null }, create: { studioId: user.studioId, replacementCreditId: credit.id, tokenHash: hash(token), expiresAt } });
    await this.audit.record({ studioId: user.studioId, actorStaffId: user.staffMemberId, action: 'replacement_links.created', entityType: 'PublicReplacementLink', entityId: link.id, metadata: { expiresAt: expiresAt.toISOString() } });
    return { id: link.id, url: `${this.config.publicWebUrl ?? 'http://localhost:3000'}/public/reposicao/${token}`, expiresAt };
  }

  async publicDetails(token: string) {
    const link = await this.open(token);
    const credit = await this.prisma.replacementCredit.findUniqueOrThrow({ where: { id: link.replacementCreditId }, select: { studioId: true, expiresAt: true } });
    const sessions = await this.prisma.classSession.findMany({ where: { studioId: credit.studioId, startsAt: { gt: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) }, status: 'SCHEDULED' }, include: { professional: { select: { name: true } }, bookings: { where: { status: { in: [BookingStatus.BOOKED, BookingStatus.COMPLETED] } }, select: { id: true } } }, orderBy: { startsAt: 'asc' } });
    const available = sessions.filter((session) => session.bookings.length < session.capacity).map((session) => ({ id: session.id, startsAt: session.startsAt, endsAt: session.endsAt, professionalName: session.professional.name, remaining: session.capacity - session.bookings.length }));
    const studio = await this.prisma.studio.findUniqueOrThrow({ where: { id: credit.studioId }, select: { name: true, brandColor: true } });
    return { studio, expiresAt: link.expiresAt, creditExpiresAt: credit.expiresAt, sessions: available };
  }

  async reserve(token: string, dto: ReserveReplacementDto) {
    const link = await this.open(token);
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.publicReplacementLink.findUniqueOrThrow({ where: { id: link.id } });
      if (current.status !== PublicReplacementLinkStatus.OPEN || current.expiresAt <= new Date()) throw new BadRequestException('Replacement link is no longer available');
      const credit = await tx.replacementCredit.findFirstOrThrow({ where: { id: current.replacementCreditId, studioId: current.studioId, status: 'AVAILABLE', expiresAt: { gt: new Date() } } });
      const session = await tx.classSession.findFirstOrThrow({ where: { id: dto.classSessionId, studioId: current.studioId, status: 'SCHEDULED', startsAt: { gt: new Date(), lte: new Date(Date.now() + 7 * 86_400_000) } } });
      const occupied = await tx.classBooking.count({ where: { studioId: current.studioId, classSessionId: session.id, status: { in: [BookingStatus.BOOKED, BookingStatus.COMPLETED] } } });
      if (occupied >= session.capacity) throw new BadRequestException('Class capacity exceeded');
      const booking = await tx.classBooking.create({ data: { studioId: current.studioId, classSessionId: session.id, studentId: credit.studentId, bookingType: BookingType.REPLACEMENT, replacementCreditId: credit.id } });
      await tx.replacementCredit.update({ where: { id: credit.id }, data: { status: 'RESERVED', usedBookingId: booking.id } });
      await tx.publicReplacementLink.update({ where: { id: current.id }, data: { status: PublicReplacementLinkStatus.USED, usedAt: new Date() } });
      return { startsAt: session.startsAt, endsAt: session.endsAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { reserved: true, session: result };
  }

  async revoke(user: AuthenticatedUser, id: string) { const link = await this.prisma.publicReplacementLink.findFirstOrThrow({ where: { id, studioId: user.studioId, status: PublicReplacementLinkStatus.OPEN } }); return this.prisma.publicReplacementLink.update({ where: { id: link.id }, data: { status: PublicReplacementLinkStatus.REVOKED, revokedAt: new Date() }, select: { id: true, status: true } }); }
  private async open(token: string) { const link = await this.prisma.publicReplacementLink.findUnique({ where: { tokenHash: hash(token) } }); if (!link) throw new NotFoundException('Replacement link not found'); if (link.status !== PublicReplacementLinkStatus.OPEN) throw new BadRequestException('Replacement link is no longer available'); if (link.expiresAt <= new Date()) { await this.prisma.publicReplacementLink.update({ where: { id: link.id }, data: { status: PublicReplacementLinkStatus.EXPIRED } }); throw new BadRequestException('Replacement link has expired'); } return link; }
}
function hash(token: string): string { return createHash('sha256').update(token).digest('hex'); }
