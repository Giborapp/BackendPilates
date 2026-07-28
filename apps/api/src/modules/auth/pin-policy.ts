const BLOCKED_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321']);

export function assertPinAllowed(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error('PIN must have four digits');
  }
  if (BLOCKED_PINS.has(pin) || isSequential(pin)) {
    throw new Error('PIN is too obvious');
  }
}

function isSequential(pin: string): boolean {
  const digits = pin.split('').map(Number);
  const ascending = digits.every((digit, index) => {
    const previous = digits[index - 1];
    return index === 0 || (previous !== undefined && digit === previous + 1);
  });
  const descending = digits.every((digit, index) => {
    const previous = digits[index - 1];
    return index === 0 || (previous !== undefined && digit === previous - 1);
  });
  return ascending || descending;
}
