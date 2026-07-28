import { assertPinAllowed } from '../src/modules/auth/pin-policy';

describe('PIN policy', () => {
  it('accepts non-obvious four digit PINs', () => {
    expect(() => assertPinAllowed('9071')).not.toThrow();
  });

  it.each(['0000', '1111', '1234', '4321', '2345', '5432'])(
    'rejects obvious PIN %s',
    (pin) => {
      expect(() => assertPinAllowed(pin)).toThrow('PIN is too obvious');
    },
  );

  it('rejects non four digit PINs', () => {
    expect(() => assertPinAllowed('12345')).toThrow('PIN must have four digits');
  });
});
