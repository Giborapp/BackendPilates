import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  AttendanceStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  StudentStatus,
  Weekday,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { BootstrapDemoDto } from './setup.dto';

type DemoStaff = {
  name: string;
  role: Role;
  pin: string;
};

const DEMO_STAFF: DemoStaff[] = [
  { name: 'Admin Demo', role: Role.ADMIN, pin: '9071' },
  { name: 'Ana Profissional', role: Role.PROFESSIONAL, pin: '2580' },
  { name: 'Bruno Profissional', role: Role.PROFESSIONAL, pin: '3690' },
  { name: 'Recepcao Demo', role: Role.RECEPTION, pin: '7410' },
];

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async createDemo(dto: BootstrapDemoDto) {
    const studioCount = await this.prisma.studio.count();
    if (studioCount > 0) {
      throw new ConflictException('Setup already completed');
    }

    const email = (dto.studioEmail ?? 'demo@pilates.local').trim().toLowerCase();
    const password = dto.studioPassword ?? 'Demo@123456';
    const now = new Date();
    const passwordHash = await argon2.hash(password);
    const staffInputs = await Promise.all(
      DEMO_STAFF.map(async (member) => ({
        ...member,
        pinHash: await argon2.hash(member.pin),
      })),
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const studio = await tx.studio.create({
        data: {
          name: dto.studioName ?? 'Studio Demo Pilates',
          slug: 'studio-demo',
          email,
          passwordHash,
          phone: '+55 11 99999-0000',
          settings: { create: {} },
        },
      });

      const staff = await Promise.all(
        staffInputs.map((member) =>
          tx.staffMember.create({
            data: {
              studioId: studio.id,
              name: member.name,
              role: member.role,
              pinHash: member.pinHash,
              pinLookupHash: this.pinLookup(studio.id, member.pin),
            },
          }),
        ),
      );
      const admin = staff.find((member) => member.role === Role.ADMIN);
      const proA = staff.find((member) => member.name === 'Ana Profissional');
      const proB = staff.find((member) => member.name === 'Bruno Profissional');
      if (!admin || !proA || !proB) {
        throw new InternalServerErrorException('Demo staff creation failed');
      }

      const unit = await tx.unit.create({
        data: {
          studioId: studio.id,
          name: 'Unidade Central',
          street: 'Rua Demo',
          number: '100',
          city: 'Sao Paulo',
          state: 'SP',
        },
      });
      const room = await tx.room.create({
        data: { studioId: studio.id, unitId: unit.id, name: 'Sala Aparelhos', defaultCapacity: 6 },
      });
      await tx.room.create({
        data: { studioId: studio.id, unitId: unit.id, name: 'Sala Solo', defaultCapacity: 4 },
      });

      const maria = await tx.student.create({
        data: {
          studioId: studio.id,
          fullName: 'Maria Souza',
          preferredName: 'Maria',
          email: 'maria@example.test',
          phone: '+55 11 90000-0001',
          status: StudentStatus.ACTIVE,
          startDate: now,
          monthlyLessonLimit: 8,
        },
      });
      const joao = await tx.student.create({
        data: {
          studioId: studio.id,
          fullName: 'Joao Lima',
          preferredName: 'Joao',
          phone: '+55 11 90000-0002',
          status: StudentStatus.ACTIVE,
          startDate: now,
          monthlyLessonLimit: 8,
        },
      });
      const trialStudent = await tx.student.create({
        data: {
          studioId: studio.id,
          fullName: 'Clara Trial',
          phone: '+55 11 90000-0003',
          status: StudentStatus.TRIAL,
          monthlyLessonLimit: 1,
        },
      });
      await tx.trialProcess.create({
        data: {
          studioId: studio.id,
          studentId: trialStudent.id,
          source: 'Instagram',
          responsibleStaffId: proA.id,
          notes: 'Interessada em turma noturna',
        },
      });

      const plan = await tx.plan.create({
        data: {
          studioId: studio.id,
          name: '2x por semana',
          sessionsPerWeek: 2,
          defaultAmount: '390.00',
          defaultBillingDay: 10,
          durationMonths: 12,
        },
      });
      const studentPlan = await tx.studentPlan.create({
        data: {
          studioId: studio.id,
          studentId: maria.id,
          planId: plan.id,
          sessionsPerWeek: plan.sessionsPerWeek,
          amount: '390.00',
          billingDay: 10,
          startDate: now,
          status: 'ACTIVE',
        },
      });
      await tx.payment.createMany({
        data: [
          {
            studioId: studio.id,
            studentId: maria.id,
            studentPlanId: studentPlan.id,
            referenceMonth: now,
            dueDate: now,
            amount: '390.00',
            status: PaymentStatus.PAID,
            paidAt: now,
            paymentMethod: PaymentMethod.PIX,
          },
          {
            studioId: studio.id,
            studentId: joao.id,
            referenceMonth: now,
            dueDate: new Date(now.getTime() + 5 * 86_400_000),
            amount: '390.00',
            status: PaymentStatus.PENDING,
          },
        ],
      });

      const schedule = await tx.recurringClassSchedule.create({
        data: {
          studioId: studio.id,
          unitId: unit.id,
          roomId: room.id,
          professionalId: proA.id,
          weekday: Weekday.MONDAY,
          startTime: '09:00',
          durationMinutes: 50,
          capacity: 6,
          startsOn: now,
        },
      });
      const session = await tx.classSession.create({
        data: {
          studioId: studio.id,
          recurringScheduleId: schedule.id,
          unitId: unit.id,
          roomId: room.id,
          professionalId: proA.id,
          startsAt: now,
          endsAt: new Date(now.getTime() + 50 * 60_000),
          capacity: 6,
        },
      });
      const booking = await tx.classBooking.create({
        data: {
          studioId: studio.id,
          classSessionId: session.id,
          studentId: maria.id,
          bookingType: 'FIXED',
          createdByStaffId: admin.id,
        },
      });
      await tx.classBooking.create({
        data: {
          studioId: studio.id,
          classSessionId: session.id,
          studentId: joao.id,
          bookingType: 'FIXED',
          createdByStaffId: admin.id,
        },
      });
      const attendance = await tx.attendance.create({
        data: {
          studioId: studio.id,
          classBookingId: booking.id,
          status: AttendanceStatus.JUSTIFIED_ABSENCE,
          justification: 'Avisou com antecedencia',
          markedByStaffId: proA.id,
        },
      });
      await tx.replacementCredit.create({
        data: {
          studioId: studio.id,
          studentId: maria.id,
          sourceAttendanceId: attendance.id,
          expiresAt: new Date(now.getTime() + 30 * 86_400_000),
          notes: 'Credito demo',
        },
      });

      const template = await tx.assessmentTemplate.create({
        data: {
          studioId: studio.id,
          name: 'Anamnese inicial',
          version: 1,
          createdByStaffId: proB.id,
          fields: [
            {
              id: 'main_complaint',
              label: 'Queixa principal',
              type: 'long_text',
              required: true,
              order: 1,
            },
            {
              id: 'pain_level',
              label: 'Nivel de dor',
              type: 'pain_scale',
              minimum: 0,
              maximum: 10,
              order: 2,
            },
          ],
        },
      });
      await tx.assessment.create({
        data: {
          studioId: studio.id,
          studentId: maria.id,
          templateId: template.id,
          templateVersion: 1,
          answers: { main_complaint: 'Dor lombar eventual', pain_level: 3 },
          status: 'COMPLETED',
          performedByStaffId: proB.id,
          completedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          studioId: studio.id,
          actorStaffId: admin.id,
          action: 'setup.demo_created',
          entityType: 'Studio',
          entityId: studio.id,
          metadata: { demo: true },
        },
      });

      return {
        studio,
        staff: staff.map((member, index) => ({
          name: member.name,
          role: member.role,
          pin: DEMO_STAFF[index]?.pin,
        })),
      };
    });

    return {
      created: true,
      studio: {
        id: result.studio.id,
        name: result.studio.name,
        email: result.studio.email,
        password,
      },
      pins: result.staff,
      loginUrl: '/auth/studio/login',
      unlockUrl: '/auth/pin/unlock',
    };
  }

  private pinLookup(studioId: string, pin: string): string {
    return createHash('sha256').update(`${studioId}:${pin}`).digest('hex');
  }
}
