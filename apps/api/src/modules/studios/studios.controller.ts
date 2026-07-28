import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/shared/auth/jwt-auth.guard';
import { CurrentUser } from '@/shared/auth/current-user.decorator';
import type { AuthenticatedUser } from '@/shared/auth/auth.types';
import { PrismaService } from '@/shared/prisma/prisma.service';

@ApiTags('studios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('studios')
export class StudiosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('current')
  async current(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.studio.findUnique({
      where: { id: user.studioId },
      select: { id: true, name: true, slug: true, email: true, phone: true, timezone: true, locale: true, currency: true, status: true },
    });
  }
}
