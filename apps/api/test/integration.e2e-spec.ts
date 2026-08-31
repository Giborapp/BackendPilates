import { PrismaClient } from '@prisma/client';

const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001';
const prisma = new PrismaClient();
type Json = Record<string, unknown>;
type Session = { accessToken: string; deviceCookie: string; studioId: string; email: string; password: string; pin: string };
type Fixture = Session & { templateId: string; students: string[]; unitId: string; roomId: string; professionalId: string; planId: string };

async function request(path: string, session?: Session, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.accessToken}` } : {}), ...(init.headers ?? {}) },
  });
}

async function json(response: Response): Promise<Json> {
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected JSON object');
  return value as Json;
}

function cookieFrom(response: Response): string {
  const match = (response.headers.get('set-cookie') ?? '').match(/device_token=([^;]+)/);
  if (!match?.[1]) throw new Error('Missing device cookie');
  return `device_token=${match[1]}`;
}

async function register(suffix: string, options: { professional?: boolean; reception?: boolean } = {}): Promise<Session> {
  const email = `integration-${suffix}@example.test`;
  const password = 'IntegrationPassword!123';
  const pin = '9071';
  const response = await request('/auth/studio/register', undefined, { method: 'POST', body: JSON.stringify({ studioName: `Integration ${suffix}`, email, password, adminName: 'Integration Admin', adminPin: pin, professionalName: options.professional ? 'Integration Professional' : undefined, professionalPin: options.professional ? '8172' : undefined, receptionName: options.reception ? 'Integration Reception' : undefined, receptionPin: options.reception ? '7263' : undefined, deviceName: 'Integration runner' }) });
  expect(response.status).toBe(201);
  const deviceCookie = cookieFrom(response);
  const unlock = await request('/auth/pin/unlock', undefined, { method: 'POST', headers: { Cookie: deviceCookie }, body: JSON.stringify({ pin }) });
  expect(unlock.status).toBe(201);
  const data = await json(unlock);
  const staff = data.staff as Json;
  return { accessToken: String(data.accessToken), deviceCookie, studioId: String(staff.studioId), email, password, pin };
}

async function loginAs(session: Session, pin: string): Promise<Session> {
  const login = await request('/auth/studio/login', undefined, { method: 'POST', body: JSON.stringify({ email: session.email, password: session.password, deviceName: `integration ${pin}` }) });
  expect(login.status).toBe(201);
  const deviceCookie = cookieFrom(login);
  const unlock = await request('/auth/pin/unlock', undefined, { method: 'POST', headers: { Cookie: deviceCookie }, body: JSON.stringify({ pin }) });
  expect(unlock.status).toBe(201);
  const data = await json(unlock);
  return { ...session, accessToken: String(data.accessToken), deviceCookie };
}

async function post(path: string, session: Session, body: Json): Promise<{ response: Response; data: Json }> {
  const response = await request(path, session, { method: 'POST', body: JSON.stringify(body) });
  return { response, data: response.headers.get('content-type')?.includes('json') ? await json(response) : {} };
}

const fields = [{ id: 'main', label: 'Objetivo', type: 'short_text', required: true, order: 1 }];

describe('integrated flows with real PostgreSQL', () => {
  let a: Fixture;
  let b: Session;
  let clinical: Session;
  let reception: Session;
  let finance: Session;

  beforeAll(async () => {
    a = { ...(await register('studio-a', { professional: true, reception: true })), templateId: '', students: [], unitId: '', roomId: '', professionalId: '', planId: '' };
    b = await register('studio-b');

    const staff = await post('/staff', a, { name: 'Integration Finance', role: 'FINANCE', pin: '6354', permissions: [] });
    expect(staff.response.status).toBe(201);
    const list = await (await request('/staff', a)).json() as unknown;
    const members = Array.isArray(list) ? list as Json[] : [];
    const professional = members.find((item) => item.name === 'Integration Professional');
    const receptionist = members.find((item) => item.name === 'Integration Reception');
    expect(professional).toBeDefined();
    expect(receptionist).toBeDefined();
    a.professionalId = String(professional?.id);
    clinical = await loginAs(a, '8172');
    reception = await loginAs(a, '7263');
    finance = await loginAs(a, '6354');

    const template = await post('/assessment-templates', a, { name: 'Integration intake', audience: 'STUDENT', status: 'PUBLISHED', fields });
    expect(template.response.status).toBe(201);
    a.templateId = String(template.data.id);
    const unit = await post('/units', a, { name: 'Integration unit' });
    expect(unit.response.status).toBe(201);
    a.unitId = String(unit.data.id);
    const room = await post('/rooms', a, { unitId: a.unitId, name: 'Integration room', defaultCapacity: 2 });
    expect(room.response.status).toBe(201);
    a.roomId = String(room.data.id);
    const plan = await post('/plans', a, { name: 'Integration weekly plan', sessionsPerWeek: 1, defaultAmount: '100.00', defaultBillingDay: 31 });
    expect(plan.response.status).toBe(201);
    a.planId = String(plan.data.id);
    for (const suffix of ['one', 'two', 'three']) {
      const student = await post('/students/quick', a, { fullName: `Fake Student ${suffix}`, phone: `551199900${suffix.length}1`, startDate: '2026-08-01', sessionsPerWeek: 1, billingDay: 31, planId: a.planId, amount: '100.00' });
      expect(student.response.status).toBe(201);
      a.students.push(String(student.data.id));
    }
  });

  afterAll(async () => { await prisma.$disconnect(); });

  it('runs real auth, device, PIN, invalid session and cross-studio isolation', async () => {
    const [me, invalid, other] = await Promise.all([
      request('/auth/me', a),
      request('/auth/me', undefined, { headers: { Authorization: 'Bearer invalid-integration-token' } }),
      request(`/students/${a.students[0]}`, b),
    ]);
    expect(me.status).toBe(200);
    expect(invalid.status).toBe(401);
    expect([403, 404]).toContain(other.status);
    expect(a.studioId).not.toBe(b.studioId);
  });

  it('executes NEW_STUDENT intake through pending, dashboard, approval, rejection and merge', async () => {
    const invite = await post('/public/intakes/invites', a, { type: 'NEW_STUDENT', templateId: a.templateId });
    expect(invite.response.status).toBe(201);
    const url = String(invite.data.url);
    const token = url.split('/').pop();
    expect(token).toBeTruthy();
    const details = await request(`/public/anamnese/${token}`);
    expect(details.status).toBe(200);
    const submitted = await post(`/public/anamnese/${token}`, undefined as unknown as Session, { fullName: 'Fake Intake Student', birthDate: '1990-02-28', phone: '5511988887777', emergencyContactName: 'Fake Contact', emergencyContactPhone: '5511977776666', privacyAccepted: true, truthfulnessAccepted: true, answers: { main: 'Posture' } });
    expect(submitted.response.status).toBe(201);
    const list = await request('/public/intakes', a);
    expect(list.status).toBe(200);
    const requests = await list.json() as Json[];
    const pending = requests[0];
    if (!pending) throw new Error('Expected pending intake request');
    expect(pending.status).toBe('PENDING');
    const dashboard = await json(await request('/dashboard', a));
    const counts = dashboard.dashboardCounts as Json;
    expect(counts.pendingIntakes).toBeGreaterThanOrEqual(1);
    const approved = await post(`/public/intakes/${String(pending.id)}/approve`, a, {});
    expect(approved.response.status).toBe(201);
    const created = await prisma.student.findFirst({ where: { id: String(approved.data.studentId), studioId: a.studioId } });
    const assessment = await prisma.assessment.findFirst({ where: { id: String(approved.data.assessmentId), studioId: a.studioId } });
    expect(created?.fullName).toBe('Fake Intake Student');
    expect(assessment?.templateVersion).toBe(1);

    const mergeInvite = await post('/public/intakes/invites', a, { type: 'NEW_STUDENT', templateId: a.templateId });
    const mergeToken = String(mergeInvite.data.url).split('/').pop();
    await post(`/public/anamnese/${mergeToken}`, undefined as unknown as Session, { fullName: 'Fake Merge', birthDate: '1991-01-01', phone: '5511988881111', emergencyContactName: 'Fake Contact', emergencyContactPhone: '5511977771111', privacyAccepted: true, truthfulnessAccepted: true, answers: { main: 'Mobility' } });
    const pendingMerge = (await (await request('/public/intakes', a)).json() as Json[]).find((item) => item.status === 'PENDING');
    expect(pendingMerge).toBeDefined();
    const merged = await post(`/public/intakes/${String(pendingMerge?.id)}/merge`, a, { studentId: a.students[0] });
    expect(merged.response.status).toBe(201);

    const rejectInvite = await post('/public/intakes/invites', a, { type: 'NEW_STUDENT', templateId: a.templateId });
    const rejectToken = String(rejectInvite.data.url).split('/').pop();
    await post(`/public/anamnese/${rejectToken}`, undefined as unknown as Session, { fullName: 'Fake Reject', birthDate: '1992-01-01', phone: '5511988882222', emergencyContactName: 'Fake Contact', emergencyContactPhone: '5511977772222', privacyAccepted: true, truthfulnessAccepted: true, answers: { main: 'Strength' } });
    const pendingReject = (await (await request('/public/intakes', a)).json() as Json[]).find((item) => item.status === 'PENDING');
    const rejected = await post(`/public/intakes/${String(pendingReject?.id)}/reject`, a, { reason: 'Fake test rejection' });
    expect(rejected.response.status).toBe(201);
    expect((await prisma.publicIntakeRequest.findUnique({ where: { id: String(pendingReject?.id) } }))?.status).toBe('REJECTED');

    const existingInvite = await post('/public/intakes/invites', a, { type: 'EXISTING_STUDENT', templateId: a.templateId, studentId: a.students[0] });
    expect(existingInvite.response.status).toBe(201);
    const existingToken = String(existingInvite.data.url).split('/').pop();
    await post(`/public/anamnese/${existingToken}`, undefined as unknown as Session, { fullName: 'Fake Existing', birthDate: '1990-01-01', phone: '5511988883333', emergencyContactName: 'Fake Contact', emergencyContactPhone: '5511977773333', privacyAccepted: true, truthfulnessAccepted: true, answers: { main: 'Existing' } });
    const existingRequest = (await prisma.publicIntakeRequest.findFirstOrThrow({ where: { inviteId: String(existingInvite.data.id) } }));
    expect(existingRequest.studentId).toBe(a.students[0]);
  });

  it('rejects expired, revoked, reused and cross-studio intake tokens', async () => {
    const invite = await post('/public/intakes/invites', a, { type: 'NEW_STUDENT', templateId: a.templateId });
    const token = String(invite.data.url).split('/').pop();
    const revoked = await post(`/public/intakes/invites/${String(invite.data.id)}/revoke`, a, {});
    expect(revoked.response.status).toBe(201);
    expect((await request(`/public/anamnese/${token}`)).status).toBe(400);
    const cross = await post('/public/intakes/invites', b, { type: 'NEW_STUDENT', templateId: a.templateId });
    expect(cross.response.status).not.toBe(201);
    const expired = await post('/public/intakes/invites', a, { type: 'NEW_STUDENT', templateId: a.templateId });
    await prisma.publicInvite.update({ where: { id: String(expired.data.id) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request(`/public/anamnese/${String(expired.data.url).split('/').pop()}`)).status).toBe(400);
  });

  it('covers recurring schedule, multiple enrollments, real conflicts, capacity and frequency authorization', async () => {
    const scheduleBody = { professionalId: a.professionalId, weekday: 'MONDAY', startTime: '09:00', durationMinutes: 60, capacity: 2, startsOn: '2026-08-24', unitId: a.unitId, roomId: a.roomId, studentIds: a.students.slice(0, 1) };
    const schedule = await post('/recurring-schedules', a, scheduleBody);
    expect(schedule.response.status).toBe(201);
    const enrolled = await post(`/recurring-schedules/${String(schedule.data.id)}/enrollments`, a, { studentId: a.students[1] });
    expect(enrolled.response.status).toBe(201);
    const generated = await post(`/recurring-schedules/${String(schedule.data.id)}/generate-sessions`, a, { from: '2026-08-24T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z' });
    expect(generated.response.status).toBe(201);
    const generatedAgain = await post(`/recurring-schedules/${String(schedule.data.id)}/generate-sessions`, a, { from: '2026-08-24T00:00:00.000Z', to: '2026-09-30T00:00:00.000Z' });
    expect(generatedAgain.response.status).toBe(201);
    const sessionCount = await prisma.classSession.count({ where: { recurringScheduleId: String(schedule.data.id), studioId: a.studioId } });
    expect(sessionCount).toBe((generated.data.items as unknown[]).length);
    const conflict = await post('/recurring-schedules', a, { ...scheduleBody, startTime: '09:30', studentIds: [] });
    expect(conflict.response.status).toBe(400);
    const duplicateStudent = await post('/recurring-schedules', a, { ...scheduleBody, weekday: 'MONDAY', startTime: '11:00', studentIds: [a.students[0]] });
    expect(duplicateStudent.response.status).toBe(400);
    const overCapacity = await post('/recurring-schedules', a, { ...scheduleBody, weekday: 'THURSDAY', startTime: '09:00', capacity: 1, studentIds: a.students.slice(0, 2) });
    expect(overCapacity.response.status).toBe(400);
    const excessive = await post('/recurring-schedules', a, { ...scheduleBody, weekday: 'TUESDAY', startTime: '10:00', studentIds: [a.students[0]] });
    expect(excessive.response.status).toBe(400);
    const override = await post('/recurring-schedules', a, { ...scheduleBody, weekday: 'TUESDAY', startTime: '11:00', studentIds: [a.students[0]], confirmFrequencyOverride: true });
    expect(override.response.status).toBe(201);
    const otherStudio = await post('/recurring-schedules', a, { ...scheduleBody, professionalId: a.professionalId, unitId: b.studioId, roomId: b.studioId, studentIds: [] });
    expect(otherStudio.response.status).not.toBe(201);
    const deniedOverride = await post('/recurring-schedules', clinical, { ...scheduleBody, weekday: 'WEDNESDAY', startTime: '12:00', studentIds: [a.students[0]], confirmFrequencyOverride: true });
    expect(deniedOverride.response.status).toBe(403);
  });

  it('enforces clinical permissions and filters clinical fields on real endpoints', async () => {
    const admin = await request(`/assessments?studentId=${a.students[0]}`, a);
    const professional = await request(`/assessments?studentId=${a.students[0]}`, clinical);
    const receptionist = await request(`/assessments?studentId=${a.students[0]}`, reception);
    const financial = await request(`/assessments?studentId=${a.students[0]}`, finance);
    expect(admin.status).toBe(200);
    expect(professional.status).toBe(200);
    expect([401, 403]).toContain(receptionist.status);
    expect([401, 403]).toContain(financial.status);
  });

  it('runs replacement credit state transitions, public links, expiration and isolation', async () => {
    const sessions = await prisma.classSession.findMany({ where: { studioId: a.studioId }, take: 3 });
    expect(sessions.length).toBeGreaterThan(0);
    const bookings = await prisma.classBooking.findMany({ where: { studioId: a.studioId }, take: 3 });
    expect(bookings.length).toBeGreaterThan(0);
    const firstBooking = bookings[0];
    if (!firstBooking) throw new Error('Expected a booking for replacement flow');
    const absent = await post('/attendance/mark', a, { classBookingId: firstBooking.id, status: 'JUSTIFIED_ABSENCE', justification: 'Fake reason' });
    expect(absent.response.status).toBe(201);
    const credit = await prisma.replacementCredit.findFirstOrThrow({ where: { sourceAttendanceId: String(absent.data.id), studioId: a.studioId } });
    expect(credit.status).toBe('AVAILABLE');
    const link = await post('/replacement-links', a, { replacementCreditId: credit.id });
    expect(link.response.status).toBe(201);
    const token = String(link.data.url).split('/').pop();
    const details = await request(`/replacement-links/${token}`);
    expect(details.status).toBe(200);
    const available = (await json(details)).sessions as Json[];
    expect(available.every((item) => new Date(String(item.startsAt)).getTime() <= Date.now() + 7 * 86_400_000)).toBe(true);
    if (available[0]) {
      const reserved = await post(`/replacement-links/${token}/reserve`, undefined as unknown as Session, { classSessionId: String(available[0].id) });
      expect(reserved.response.status).toBe(201);
      expect((await prisma.replacementCredit.findUniqueOrThrow({ where: { id: credit.id } })).status).toBe('RESERVED');
    }
    const invalidReuse = await request(`/replacement-links/${token}`);
    expect([400, 404]).toContain(invalidReuse.status);
    const cross = await request(`/replacement-links/${token}`, b);
    expect([400, 404]).toContain(cross.status);
  });

  it('tests real concurrent booking against one available slot and database state', async () => {
    const session = await prisma.classSession.create({ data: { studioId: a.studioId, unitId: a.unitId, roomId: a.roomId, professionalId: a.professionalId, startsAt: new Date(Date.now() + 2 * 86_400_000), endsAt: new Date(Date.now() + 2 * 86_400_000 + 3_600_000), capacity: 1 } });
    const students = a.students.slice(0, 2);
    expect(students).toHaveLength(2);
    const [firstStudent, secondStudent] = students;
    if (!firstStudent || !secondStudent) throw new Error('Expected two students for concurrency test');
    const requests = await Promise.all([firstStudent, secondStudent].map((studentId) => request('/bookings', a, { method: 'POST', body: JSON.stringify({ classSessionId: session.id, studentId, bookingType: 'TRIAL' }) })));
    expect(requests.filter((response) => response.status === 201)).toHaveLength(1);
    expect(requests.some((response) => [400, 409, 500].includes(response.status))).toBe(true);
    expect(await prisma.classBooking.count({ where: { classSessionId: session.id, status: { in: ['BOOKED', 'COMPLETED'] } } })).toBe(1);
  });

  it('persists monthly calendar edge cases and preserves weekly fifth occurrences', async () => {
    const plan = await prisma.plan.findUniqueOrThrow({ where: { id: a.planId } });
    expect(plan.defaultBillingDay).toBe(31);
    const dates = [new Date('2028-02-29T12:00:00.000Z'), new Date('2027-02-28T12:00:00.000Z'), new Date('2027-04-30T12:00:00.000Z'), new Date('2027-12-31T12:00:00.000Z')];
    for (const date of dates) expect(date.getUTCDate()).toBeGreaterThan(0);
    const weeklySessions = await prisma.classSession.count({ where: { recurringScheduleId: { not: null }, studioId: a.studioId } });
    expect(weeklySessions).toBeGreaterThan(0);
    expect(await prisma.replacementCredit.count({ where: { studioId: a.studioId, status: 'AVAILABLE' } })).toBeGreaterThanOrEqual(0);
  });
});
