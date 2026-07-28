import { BadRequestException } from '@nestjs/common';
import { parseTemplateFields, validateAnswers } from '../src/shared/domain/assessment-validator';

describe('assessment validator', () => {
  const fields = parseTemplateFields([
    { id: 'complaint', label: 'Complaint', type: 'long_text', required: true },
    { id: 'pain', label: 'Pain', type: 'pain_scale' },
    { id: 'confirmed', label: 'Confirmed', type: 'boolean' },
    { id: 'source', label: 'Source', type: 'single_select', options: ['doctor', 'friend'] },
  ]);

  it('validates compatible answers', () => {
    expect(() =>
      validateAnswers(fields, {
        complaint: 'Back pain',
        pain: 3,
        confirmed: true,
        source: 'doctor',
      }),
    ).not.toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => validateAnswers(fields, { pain: 3 })).toThrow(BadRequestException);
  });

  it('rejects invalid select options', () => {
    expect(() =>
      validateAnswers(fields, {
        complaint: 'Back pain',
        source: 'invalid',
      }),
    ).toThrow(BadRequestException);
  });
});
