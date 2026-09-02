import { BadRequestException } from '@nestjs/common';
import { parseTemplateFields, requiresProfessionalReview, validateAnswers } from '../src/shared/domain/assessment-validator';

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

  it('counts sections outside the forty-question limit', () => {
    const fields = Array.from({ length: 40 }, (_, index) => ({ id: `q${index}`, label: `Question ${index}`, type: 'short_text' }));
    expect(() => parseTemplateFields([{ id: 'section', label: 'Section', type: 'section' }, ...fields])).not.toThrow();
    expect(() => parseTemplateFields([...fields, { id: 'q40', label: 'Question 40', type: 'short_text' }])).toThrow(BadRequestException);
  });

  it('validates all supported field types and numeric ranges', () => {
    expect(() => parseTemplateFields([
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'multi', label: 'Multi', type: 'multi_select', options: ['a', 'b'] },
      { id: 'scale', label: 'Scale', type: 'numeric_scale', minimum: 1, maximum: 5 },
      { id: 'measure', label: 'Measure', type: 'measure', unit: 'cm' },
      { id: 'section', label: 'Section', type: 'section' },
    ])).not.toThrow();
    expect(() => parseTemplateFields([{ id: 'pain', label: 'Pain', type: 'pain_scale', minimum: 1, maximum: 10 }])).toThrow(BadRequestException);
  });

  it('enforces exclusive answers and detects clinical review rules', () => {
    const parsed = parseTemplateFields([
      { id: 'conditions', label: 'Conditions', type: 'multi_select', options: ['Nenhuma', 'Hipertensao'], exclusiveOptions: ['Nenhuma'], reviewWhen: { excludes: ['Nenhuma'] } },
      { id: 'pain', label: 'Pain', type: 'pain_scale', reviewWhen: { minimum: 7 } },
    ]);
    expect(() => validateAnswers(parsed, { conditions: ['Nenhuma', 'Hipertensao'], pain: 1 })).toThrow(BadRequestException);
    expect(requiresProfessionalReview(parsed, { conditions: ['Hipertensao'], pain: 1 })).toBe(true);
    expect(requiresProfessionalReview(parsed, { conditions: ['Nenhuma'], pain: 8 })).toBe(true);
  });
});
