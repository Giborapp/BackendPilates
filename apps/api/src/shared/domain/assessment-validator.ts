import { BadRequestException } from '@nestjs/common';

export const ASSESSMENT_FIELD_TYPES = [
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
  'section',
] as const;

export type AssessmentFieldType = (typeof ASSESSMENT_FIELD_TYPES)[number];

export type TemplateField = {
  id: string;
  label: string;
  type: AssessmentFieldType;
  description?: string;
  required?: boolean;
  options?: string[];
  unit?: string;
  order?: number;
  minimum?: number;
  maximum?: number;
  reviewWhen?: { equals?: unknown; includesAny?: string[]; excludes?: string[]; minimum?: number };
  exclusiveOptions?: string[];
};

const FIELD_TYPES = new Set<string>(ASSESSMENT_FIELD_TYPES);
const MAX_QUESTIONS = 40;

export function parseTemplateFields(fields: unknown): TemplateField[] {
  if (!Array.isArray(fields)) {
    throw new BadRequestException('Template fields must be an array');
  }
  const parsed = fields.map((field, index) => {
    if (!field || typeof field !== 'object') {
      throw new BadRequestException(`Invalid field at index ${index}`);
    }
    const candidate = field as Partial<TemplateField>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.label !== 'string' ||
      candidate.label.trim().length === 0 ||
      typeof candidate.type !== 'string' ||
      !FIELD_TYPES.has(candidate.type)
    ) {
      throw new BadRequestException(`Invalid field at index ${index}`);
    }
    if (['single_select', 'multi_select'].includes(candidate.type)) {
      if (!Array.isArray(candidate.options) || candidate.options.length === 0 || candidate.options.some((item) => typeof item !== 'string' || item.trim() === '')) {
        throw new BadRequestException(`Options are required at index ${index}`);
      }
    }
    const minimum = candidate.type === 'pain_scale' ? (candidate.minimum ?? 0) : candidate.minimum;
    const maximum = candidate.type === 'pain_scale' ? (candidate.maximum ?? 10) : candidate.maximum;
    if (candidate.type === 'pain_scale' && (minimum !== 0 || maximum !== 10)) {
      throw new BadRequestException('Pain scale must range from 0 to 10');
    }
    if (candidate.minimum !== undefined && typeof candidate.minimum !== 'number') {
      throw new BadRequestException(`Invalid minimum at index ${index}`);
    }
    if (candidate.maximum !== undefined && typeof candidate.maximum !== 'number') {
      throw new BadRequestException(`Invalid maximum at index ${index}`);
    }
    if (candidate.minimum !== undefined && candidate.maximum !== undefined && candidate.minimum > candidate.maximum) {
      throw new BadRequestException(`Invalid range at index ${index}`);
    }
    return {
      id: candidate.id,
      label: candidate.label.trim(),
      type: candidate.type,
      description: candidate.description,
      required: Boolean(candidate.required),
      options: candidate.options,
      unit: candidate.unit,
      order: candidate.order,
      minimum,
      maximum,
      reviewWhen: candidate.reviewWhen,
      exclusiveOptions: candidate.exclusiveOptions,
    };
  });
  if (parsed.filter((field) => field.type !== 'section').length > MAX_QUESTIONS) {
    throw new BadRequestException(`Templates cannot have more than ${MAX_QUESTIONS} questions`);
  }
  return parsed;
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
    if (['short_text', 'long_text'].includes(field.type) && typeof value !== 'string') {
      throw new BadRequestException(`Invalid answer type for ${field.id}`);
    }
    if (['number', 'numeric_scale', 'pain_scale', 'measure'].includes(field.type) && typeof value !== 'number') {
      throw new BadRequestException(`Invalid answer type for ${field.id}`);
    }
    if (typeof value === 'number' && field.minimum !== undefined && value < field.minimum) {
      throw new BadRequestException(`Answer below minimum for ${field.id}`);
    }
    if (typeof value === 'number' && field.maximum !== undefined && value > field.maximum) {
      throw new BadRequestException(`Answer above maximum for ${field.id}`);
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
      const selected = value.map(String);
      const exclusive = field.exclusiveOptions ?? [];
      if (selected.some((item) => exclusive.includes(item)) && selected.length > 1) {
        throw new BadRequestException(`Exclusive option cannot be combined for ${field.id}`);
      }
    }
  }
}

export function requiresProfessionalReview(fields: TemplateField[], answers: unknown): boolean {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  const values = answers as Record<string, unknown>;
  return fields.some((field) => {
    const rule = field.reviewWhen;
    const value = values[field.id];
    if (!rule || value === undefined || value === null) return false;
    if (rule.equals !== undefined && value === rule.equals) return true;
    if (rule.minimum !== undefined && typeof value === 'number' && value >= rule.minimum) return true;
    const selected = Array.isArray(value) ? value.map(String) : [String(value)];
    if (rule.includesAny?.some((item) => selected.includes(item))) return true;
    if (rule.excludes?.length && selected.some((item) => !rule.excludes?.includes(item))) return true;
    return false;
  });
}
