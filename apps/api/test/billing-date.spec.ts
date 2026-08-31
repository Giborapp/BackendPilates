import { billingDateForMonth } from '../src/shared/domain/local-time';

describe('billing date', () => {
  it.each([
    [28, 2026, 2, 28], [29, 2028, 2, 29], [29, 2026, 2, 28], [30, 2026, 2, 28], [31, 2026, 2, 28],
    [31, 2026, 4, 30], [31, 2026, 6, 30], [31, 2026, 9, 30], [31, 2026, 11, 30], [31, 2026, 1, 31],
  ])('clamps day %i for %i-%i to %i', (day, year, month, expected) => {
    expect(billingDateForMonth(year, month, day, 'America/Sao_Paulo').toISOString().slice(0, 10)).toBe(`${year}-${String(month).padStart(2, '0')}-${String(expected).padStart(2, '0')}`);
  });
  it('handles the year boundary without shifting the local day', () => expect(billingDateForMonth(2027, 1, 31, 'America/Sao_Paulo').toISOString()).toBe('2027-01-31T03:00:00.000Z'));
  it('rejects invalid days', () => expect(() => billingDateForMonth(2026, 1, 0)).toThrow(RangeError));
});
