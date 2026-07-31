import { BadRequestException } from '@nestjs/common';
import { assertRegistrationPinsAllowed } from '../src/modules/auth/studio-registration';

describe('studio registration', () => {
  it('accepts unique non-obvious PINs', () => {
    expect(() =>
      assertRegistrationPinsAllowed([
        { label: 'Admin PIN', pin: '9071' },
        { label: 'Reception PIN', pin: '7410' },
      ]),
    ).not.toThrow();
  });

  it('rejects duplicate PINs', () => {
    expect(() =>
      assertRegistrationPinsAllowed([
        { label: 'Admin PIN', pin: '9071' },
        { label: 'Reception PIN', pin: '9071' },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects obvious PINs with field context', () => {
    expect(() => assertRegistrationPinsAllowed([{ label: 'Admin PIN', pin: '1234' }])).toThrow(
      'Admin PIN',
    );
  });
});
