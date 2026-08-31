export const STUDIO_BRAND_COLORS = [
  '#1f7a6d',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#b7791f',
  '#16a34a',
  '#0891b2',
  '#4f46e5',
  '#0f766e',
  '#be123c',
  '#9333ea',
  '#047857',
  '#334155',
] as const;

export type StudioBrandColor = (typeof STUDIO_BRAND_COLORS)[number];

export const STUDIO_LOGO_MAX_BYTES = 2_000_000;
export const STUDIO_LOGO_MIME_TYPES = ['image/png', 'image/webp'] as const;

export function isStudioBrandColor(value: string): value is StudioBrandColor {
  return STUDIO_BRAND_COLORS.some((color) => color === value);
}

export function isStudioLogoMimeType(
  value: string,
): value is (typeof STUDIO_LOGO_MIME_TYPES)[number] {
  return STUDIO_LOGO_MIME_TYPES.some((mimeType) => mimeType === value);
}
