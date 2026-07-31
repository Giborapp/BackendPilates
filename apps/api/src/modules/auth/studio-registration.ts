import { BadRequestException } from '@nestjs/common';
import { assertPinAllowed } from './pin-policy';

export type RegistrationPinInput = {
  label: string;
  pin?: string;
};

export function assertRegistrationPinsAllowed(inputs: RegistrationPinInput[]): void {
  const seen = new Set<string>();
  for (const input of inputs) {
    if (!input.pin) {
      continue;
    }
    try {
      assertPinAllowed(input.pin);
    } catch (error) {
      throw new BadRequestException(
        `${input.label}: ${error instanceof Error ? error.message : 'invalid PIN'}`,
      );
    }
    if (seen.has(input.pin)) {
      throw new BadRequestException('PINs must be unique inside the studio');
    }
    seen.add(input.pin);
  }
}
