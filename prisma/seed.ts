import {
  PrismaClient,
  Role,
  StudentStatus,
  PaymentStatus,
  PaymentMethod,
  Weekday,
  AttendanceStatus,
} from "@prisma/client";
import * as argon2 from "argon2";
import { createHash } from "crypto";

const prisma = new PrismaClient();

function pinLookup(studioId: string, pin: string): string {
  return createHash("sha256").update(`${studioId}:${pin}`).digest("hex");
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed must not run in production");
  }

  const studio = await prisma.studio.upsert({
    where: { email: "demo@pilates.local" },
    update: {},
    create: {
      name: "Studio Demo Pilates",
      slug: "studio-demo",
      email: "demo@pilates.local",
      passwordHash: await argon2.hash("Demo@123456"),
      phone: "+55 11 99999-0000",
      settings: { create: {} },
    },
  });

  const admin = await upsertStaff(studio.id, "Admin Demo", Role.ADMIN, "9071");
  const proA = await upsertStaff(
    studio.id,
    "Ana Profissional",
    Role.PROFESSIONAL,
    "2580",
  );
  const proB = await upsertStaff(
    studio.id,
    "Bruno Profissional",
    Role.PROFESSIONAL,
    "3690",
  );
  await upsertStaff(studio.id, "Recepcao Demo", Role.RECEPTION, "7410");

  const unit = await prisma.unit.create({
    data: {
      studioId: studio.id,
      name: "Unidade Central",
      street: "Rua Demo",
      number: "100",
      city: "Sao Paulo",
      state: "SP",
    },
  });
  const roomA = await prisma.room.create({
    data: {
      studioId: studio.id,
      unitId: unit.id,
      name: "Sala Solo",
      defaultCapacity: 4,
    },
  });
  const roomB = await prisma.room.create({
    data: {
      studioId: studio.id,
      unitId: unit.id,
      name: "Sala Aparelhos",
      defaultCapacity: 6,
    },
  });

  const maria = await prisma.student.create({
    data: {
      studioId: studio.id,
      fullName: "Maria Souza",
      preferredName: "Maria",
      email: "maria@example.test",
      phone: "+55 11 90000-0001",
      status: StudentStatus.ACTIVE,
      startDate: new Date(),
      monthlyLessonLimit: 8,
    },
  });
  const joao = await prisma.student.create({
    data: {
      studioId: studio.id,
      fullName: "Joao Lima",
      preferredName: "Joao",
      phone: "+55 11 90000-0002",
      status: StudentStatus.ACTIVE,
      startDate: new Date(),
      monthlyLessonLimit: 8,
    },
  });
  const trialStudent = await prisma.student.create({
    data: {
      studioId: studio.id,
      fullName: "Clara Trial",
      phone: "+55 11 90000-0003",
      status: StudentStatus.TRIAL,
      monthlyLessonLimit: 1,
    },
  });
  await prisma.trialProcess.create({
    data: {
      studioId: studio.id,
      studentId: trialStudent.id,
      source: "Instagram",
      responsibleStaffId: proA.id,
      notes: "Interessada em turma noturna",
    },
  });

  const plan = await prisma.plan.create({
    data: {
      studioId: studio.id,
      name: "2x por semana",
      sessionsPerWeek: 2,
      defaultAmount: "390.00",
      defaultBillingDay: 10,
      durationMonths: 12,
    },
  });
  const studentPlan = await prisma.studentPlan.create({
    data: {
      studioId: studio.id,
      studentId: maria.id,
      planId: plan.id,
      sessionsPerWeek: plan.sessionsPerWeek,
      amount: "390.00",
      billingDay: 10,
      startDate: new Date(),
      status: "ACTIVE",
    },
  });

  const now = new Date();
  await prisma.payment.createMany({
    data: [
      {
        studioId: studio.id,
        studentId: maria.id,
        studentPlanId: studentPlan.id,
        referenceMonth: now,
        dueDate: now,
        amount: "390.00",
        status: PaymentStatus.PAID,
        paidAt: now,
        paymentMethod: PaymentMethod.PIX,
      },
      {
        studioId: studio.id,
        studentId: joao.id,
        referenceMonth: now,
        dueDate: new Date(now.getTime() + 5 * 86_400_000),
        amount: "390.00",
        status: PaymentStatus.PENDING,
      },
      {
        studioId: studio.id,
        studentId: maria.id,
        referenceMonth: now,
        dueDate: new Date(now.getTime() - 5 * 86_400_000),
        amount: "390.00",
        status: PaymentStatus.PENDING,
      },
    ],
  });

  const schedule = await prisma.recurringClassSchedule.create({
    data: {
      studioId: studio.id,
      unitId: unit.id,
      roomId: roomB.id,
      professionalId: proA.id,
      weekday: Weekday.MONDAY,
      startTime: "09:00",
      durationMinutes: 50,
      capacity: 6,
      startsOn: now,
    },
  });
  const session = await prisma.classSession.create({
    data: {
      studioId: studio.id,
      recurringScheduleId: schedule.id,
      unitId: unit.id,
      roomId: roomB.id,
      professionalId: proA.id,
      startsAt: now,
      endsAt: new Date(now.getTime() + 50 * 60_000),
      capacity: 6,
    },
  });
  const booking = await prisma.classBooking.create({
    data: {
      studioId: studio.id,
      classSessionId: session.id,
      studentId: maria.id,
      bookingType: "FIXED",
      createdByStaffId: admin.id,
    },
  });
  await prisma.classBooking.create({
    data: {
      studioId: studio.id,
      classSessionId: session.id,
      studentId: joao.id,
      bookingType: "FIXED",
      createdByStaffId: admin.id,
    },
  });
  const attendance = await prisma.attendance.create({
    data: {
      studioId: studio.id,
      classBookingId: booking.id,
      status: AttendanceStatus.JUSTIFIED_ABSENCE,
      justification: "Avisou com antecedencia",
      markedByStaffId: proA.id,
    },
  });
  await prisma.replacementCredit.create({
    data: {
      studioId: studio.id,
      studentId: maria.id,
      sourceAttendanceId: attendance.id,
      expiresAt: new Date(now.getTime() + 30 * 86_400_000),
      notes: "Credito demo",
    },
  });

  const template = await prisma.assessmentTemplate.create({
    data: {
      studioId: studio.id,
      name: "Anamnese inicial",
      version: 1,
      createdByStaffId: proB.id,
      fields: [
        {
          id: "main_complaint",
          label: "Queixa principal",
          type: "long_text",
          required: true,
          order: 1,
        },
        {
          id: "pain_level",
          label: "Nivel de dor",
          type: "pain_scale",
          minimum: 0,
          maximum: 10,
          order: 2,
        },
      ],
    },
  });
  await prisma.assessment.create({
    data: {
      studioId: studio.id,
      studentId: maria.id,
      templateId: template.id,
      templateVersion: 1,
      answers: { main_complaint: "Dor lombar eventual", pain_level: 3 },
      status: "COMPLETED",
      performedByStaffId: proB.id,
      completedAt: now,
    },
  });

  await prisma.auditLog.create({
    data: {
      studioId: studio.id,
      actorStaffId: admin.id,
      action: "seed.created",
      entityType: "Studio",
      entityId: studio.id,
      metadata: { demo: true },
    },
  });

  console.log("Demo seed created");
}

async function upsertStaff(
  studioId: string,
  name: string,
  role: Role,
  pin: string,
) {
  const existing = await prisma.staffMember.findFirst({
    where: { studioId, pinLookupHash: pinLookup(studioId, pin) },
  });
  if (existing) {
    return existing;
  }
  return prisma.staffMember.create({
    data: {
      studioId,
      name,
      role,
      pinHash: await argon2.hash(pin),
      pinLookupHash: pinLookup(studioId, pin),
    },
  });
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
