import { createHash, randomBytes } from 'crypto';

export function randomToken(): string {
  return randomBytes(48).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function addDuration(from: Date, duration: string): Date {
  const match = /^(\d+)([mhd])$/.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const ms = unit === 'm' ? amount * 60_000 : unit === 'h' ? amount * 3_600_000 : amount * 86_400_000;
  return new Date(from.getTime() + ms);
}
