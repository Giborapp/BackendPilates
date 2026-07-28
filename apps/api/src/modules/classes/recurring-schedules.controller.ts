import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Weekday } from '@prisma/client';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { PermissionsGuard } from '@/shared/auth/permissions.guard';
import { RequirePermissions } from '@/shared/auth/permissions';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { CreateScheduleDto, GenerateSessionsDto, IdParamDto } from '@/shared/http/common.dto';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('recurring-schedules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('recurring-schedules')
export class RecurringSchedulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('classes.read_all')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.recurringClassSchedule.findMany({ where: { studioId: user.studioId, active: true } });
  }

  @Post()
  @RequirePermissions('classes.create')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateScheduleDto) {
    await Promise.all([
      this.prisma.unit.findFirstOrThrow({ where: { id: dto.unitId, studioId: user.studioId } }),
      this.prisma.room.findFirstOrThrow({ where: { id: dto.roomId, studioId: user.studioId } }),
      this.prisma.staffMember.findFirstOrThrow({ where: { id: dto.professionalId, studioId: user.studioId } }),
    ]);
    return this.prisma.recurringClassSchedule.create({ data: { ...dto, studioId: user.studioId, startsOn: new Date(dto.startsOn), endsOn: dto.endsOn ? new Date(dto.endsOn) : undefined } });
  }

  @Post(':id/generate-sessions')
  @RequirePermissions('classes.create')
  async generate(@CurrentUser() user: AuthenticatedUser, @Param() params: IdParamDto, @Body() dto: GenerateSessionsDto) {
    const schedule = await this.prisma.recurringClassSchedule.findFirstOrThrow({ where: { id: params.id, studioId: user.studioId, active: true } });
    const dates = matchingDates(new Date(dto.from), new Date(dto.to), schedule.weekday);
    const created = [];
    for (const day of dates) {
      const [hour, minute] = schedule.startTime.split(':').map(Number);
      const startsAt = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour ?? 0, minute ?? 0));
      const endsAt = new Date(startsAt.getTime() + schedule.durationMinutes * 60_000);
      const session = await this.prisma.classSession.upsert({
        where: { id: '00000000-0000-0000-0000-000000000000' },
        create: { studioId: user.studioId, recurringScheduleId: schedule.id, unitId: schedule.unitId, roomId: schedule.roomId, professionalId: schedule.professionalId, startsAt, endsAt, capacity: schedule.capacity },
        update: {},
      }).catch(() => this.prisma.classSession.create({ data: { studioId: user.studioId, recurringScheduleId: schedule.id, unitId: schedule.unitId, roomId: schedule.roomId, professionalId: schedule.professionalId, startsAt, endsAt, capacity: schedule.capacity } }));
      created.push(session);
    }
    return { items: created, count: created.length };
  }
}

function matchingDates(from: Date, to: Date, weekday: Weekday): Date[] {
  const weekdayIndex: Record<Weekday, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
  const dates: Date[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (cursor <= to) {
    if (cursor.getUTCDay() === weekdayIndex[weekday]) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
