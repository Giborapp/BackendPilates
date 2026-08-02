import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { StudioStatus } from '@prisma/client';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { AttendanceService } from './attendance.service';

const AUTO_NO_SHOW_INTERVAL_MS = 15 * 60_000;

@Injectable()
export class AttendanceNoShowScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private interval: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.interval = setInterval(() => {
      void this.run();
    }, AUTO_NO_SHOW_INTERVAL_MS);
    if (typeof this.interval === 'object' && 'unref' in this.interval) {
      this.interval.unref();
    }
    void this.run();
  }

  onApplicationShutdown(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async run(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const studios = await this.prisma.studio.findMany({
        where: { status: StudioStatus.ACTIVE },
        select: { id: true },
      });
      for (const studio of studios) {
        await this.attendance.markAutomaticNoShows(studio.id);
      }
    } finally {
      this.running = false;
    }
  }
}
