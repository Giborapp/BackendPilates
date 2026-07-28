import { BadRequestException } from '@nestjs/common';

type TemplateField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  minimum?: number;
  maximum?: number;
};

const FIELD_TYPES = new Set([
  'short_text',
  'long_text',
  'number',
  'date',
  'boolean',
  'single_select',
  'multi_select',
  'numeric_scale',
  'pain_scale',
  'measure',
  'image',
  'signature',
  'section',
]);

export function parseTemplateFields(fields: unknown): TemplateField[] {
  if (!Array.isArray(fields)) {
    throw new BadRequestException('Template fields must be an array');
  }
  return fields.map((field, index) => {
    if (!field || typeof field !== 'object') {
      throw new BadRequestException(`Invalid field at index ${index}`);
    }
    const candidate = field as Partial<TemplateField>;
    if (!candidate.id || !candidate.label || !candidate.type || !FIELD_TYPES.has(candidate.type)) {
      throw new BadRequestException(`Invalid field at index ${index}`);
    }
    return {
      id: candidate.id,
      label: candidate.label,
      type: candidate.type,
      required: Boolean(candidate.required),
      options: candidate.options,
      minimum: candidate.minimum,
      maximum: candidate.maximum,
    };
  });
}

export function validateAnswers(fields: TemplateField[], answers: unknown): void {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    throw new BadRequestException('Answers must be an object');
  }
  const values = answers as Record<string, unknown>;
  for (const field of fields) {
    const value = values[field.id];
    if (field.required && (value === undefined || value === null || value === '')) {
      throw new BadRequestException(`Required field missing: ${field.id}`);
    }
    if (value === undefined || value === null || field.type === 'section') {
      continue;
    }
    if (['short_text', 'long_text', 'image', 'signature'].includes(field.type) && typeof value !== 'string') {
      throw new BadRequestException(`Invalid answer type for ${field.id}`);
    }
    if (['number', 'numeric_scale', 'pain_scale', 'measure'].includes(field.type) && typeof value !== 'number') {
      throw new BadRequestException(`Invalid answer type for ${field.id}`);
    }
    if (field.type === 'boolean' && typeof value !== 'boolean') {
      throw new BadRequestException(`Invalid answer type for ${field.id}`);
    }
    if (field.type === 'single_select' && (!field.options?.includes(String(value)))) {
      throw new BadRequestException(`Invalid option for ${field.id}`);
    }
    if (field.type === 'multi_select') {
      if (!Array.isArray(value) || value.some((item) => !field.options?.includes(String(item)))) {
        throw new BadRequestException(`Invalid options for ${field.id}`);
      }
    }
  }
}
