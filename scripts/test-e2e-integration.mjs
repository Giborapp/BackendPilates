import { existsSync, mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const frontendDir = process.env.FRONTEND_DIR ? resolve(process.env.FRONTEND_DIR) : null;
const children = [];

function refuse(message) { throw new Error(`E2E integration refused: ${message}`); }

function validateEnvironment() {
  if (process.env.NODE_ENV !== 'test') refuse('NODE_ENV must be test');
  if (process.env.E2E_INTEGRATION !== 'true') refuse('E2E_INTEGRATION must be true');
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) refuse('DATABASE_URL is required');
  let url;
  try { url = new URL(rawUrl); } catch { refuse('DATABASE_URL is invalid'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) refuse('DATABASE_URL must use PostgreSQL');
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  const forbiddenHosts = ['onrender.com', 'render.com', 'neon.tech', 'supabase.co', 'railway.app', 'amazonaws.com'];
  if (forbiddenHosts.some((marker) => host.includes(marker))) refuse('external or production database host is forbidden');
  if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(host)) refuse('database host must be local or the CI postgres service');
  if (!/(e2e|test|ci)/i.test(database)) refuse('database name must contain an explicit test marker');
  if (!process.env.LOCAL_STORAGE_PATH || !/(e2e|test|ci)/i.test(process.env.LOCAL_STORAGE_PATH)) refuse('storage path must identify a test directory');
  if (!frontendDir || !existsSync(frontendDir)) refuse('FRONTEND_DIR must point to the checked-out frontend');
  mkdirSync(process.env.LOCAL_STORAGE_PATH, { recursive: true });
}

function executable(command) { return process.platform === 'win32' ? `${command}.cmd` : command; }

function run(command, args, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable(command), args, { cwd, stdio: 'inherit', env: process.env });
    children.push(child);
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code ?? signal}`)));
  });
}

function start(command, args, cwd) {
  const child = spawn(executable(command), args, { cwd, stdio: 'inherit', env: process.env });
  children.push(child);
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* process is still starting */ }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error(`Timed out waiting for ${new URL(url).origin}`);
}

async function main() {
  validateEnvironment();
  await run('pnpm', ['prisma:generate']);
  await run('pnpm', ['--filter', '@pilates-manager/api', 'prisma:deploy']);
  start('pnpm', ['--filter', '@pilates-manager/api', 'start']);
  await waitFor(`${process.env.E2E_API_URL ?? 'http://127.0.0.1:3001'}/health`);
  start('pnpm', ['--filter', '@pilates-manager/web', 'start:local'], frontendDir);
  await waitFor(`${process.env.E2E_WEB_URL ?? 'http://127.0.0.1:2345'}/login`);
  await run('pnpm', ['--filter', '@pilates-manager/api', 'test:e2e:integration']);
  await run('pnpm', ['exec', 'playwright', 'test', '--config', 'playwright.integration.config.ts'], frontendDir);
}

try {
  await main();
} finally {
  for (const child of children.reverse()) child.kill('SIGTERM');
  if (process.env.LOCAL_STORAGE_PATH && /(e2e|test|ci)/i.test(process.env.LOCAL_STORAGE_PATH)) {
    await rm(process.env.LOCAL_STORAGE_PATH, { recursive: true, force: true });
  }
}
