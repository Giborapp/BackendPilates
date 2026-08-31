import type { AssessmentAudience } from '@prisma/client';

export type AssessmentPreset = {
  key: 'initial_anamnesis' | 'physical_evaluation';
  name: string;
  description: string;
  audience: AssessmentAudience;
  fields: Array<Record<string, unknown>>;
};

const field = (id: string, label: string, type: string, extra: Record<string, unknown> = {}) => ({
  id,
  label,
  type,
  ...extra,
});

export const ASSESSMENT_PRESETS: AssessmentPreset[] = [
  {
    key: 'initial_anamnesis',
    name: 'Anamnese inicial',
    description: 'Modelo editavel para conhecer o aluno. Nao substitui avaliacao profissional.',
    audience: 'STUDENT',
    fields: [
      field('section_context', 'Contexto e objetivos', 'section'),
      field('activity_practice', 'Pratica de atividade fisica e frequencia', 'long_text'),
      field('how_found_studio', 'Como conheceu o estudio?', 'short_text'),
      field('goals', 'Objetivos', 'long_text', { required: true }),
      field('main_complaint', 'Queixa principal', 'long_text', { required: true }),
      field('section_pain', 'Dor e movimento', 'section'),
      field('pain_history', 'Historico e duracao da dor', 'long_text'),
      field('pain_at_rest', 'Sente dor em repouso?', 'boolean'),
      field('pain_intensity', 'Intensidade da dor', 'pain_scale', { minimum: 0, maximum: 10 }),
      field('pain_worse', 'Atividades ou movimentos que pioram a dor', 'long_text'),
      field('pain_better', 'Atividades ou movimentos que melhoram a dor', 'long_text'),
      field('limited_activities', 'Atividades importantes que estao dificeis', 'long_text'),
      field('pain_type_period', 'Tipo e periodo da dor', 'long_text'),
      field('section_health', 'Saude e rotina', 'section'),
      field('chronic_conditions', 'Doencas cronicas', 'long_text'),
      field('medications', 'Medicamentos', 'long_text'),
      field('sleep', 'Qualidade e duracao do sono', 'long_text'),
      field('surgeries_accidents_treatments', 'Cirurgias, acidentes e tratamentos anteriores', 'long_text'),
      field('smoking_alcohol', 'Tabagismo e alcool', 'long_text'),
      field('leisure', 'Lazer', 'long_text'),
      field('hydration_food', 'Hidratacao e alimentacao', 'long_text'),
      field('food_restrictions', 'Restricoes alimentares', 'long_text'),
      field('bowel_function', 'Funcionamento intestinal', 'long_text'),
      field('urinary_incontinence', 'Incontinencia urinaria', 'boolean'),
      field('section_declaration', 'Declaracao', 'section'),
      field('emotional_notes', 'Observacoes emocionais', 'long_text'),
      field('truth_declaration', 'Declaro a veracidade das informacoes e ciencia das orientacoes', 'boolean', { required: true }),
    ],
  },
  {
    key: 'physical_evaluation',
    name: 'Avaliacao fisica',
    description: 'Modelo editavel para preenchimento por profissional autorizado. Nao e protocolo diagnostico.',
    audience: 'PROFESSIONAL',
    fields: [
      field('section_initial', 'Inicio e postura dinamica', 'section'),
      field('initial_goals_observations', 'Objetivos e observacoes iniciais', 'long_text'),
      field('dynamic_posture', 'Avaliacao postural dinamica', 'long_text'),
      field('head_shoulders_hips_knees_feet', 'Alinhamento de cabeca, ombros, quadril, joelhos e pes', 'long_text'),
      field('gait_analysis', 'Analise da pisada', 'long_text'),
      field('bridge_spine_hip_mobility', 'Ponte e mobilidade de coluna e quadril', 'long_text'),
      field('lumbopelvic_scapular_stability', 'Estabilidade lombopelvica e escapular', 'long_text'),
      field('sitting_standing', 'Posicionamento sentado e em pe', 'long_text'),
      field('section_strength_mobility', 'Forca e mobilidade', 'section'),
      field('limb_strength', 'Forca de membros superiores e inferiores', 'long_text'),
      field('height_fingers_floor', 'Altura e distancia dos dedos ao solo', 'measure', { unit: 'cm' }),
      field('adams_scoliosis', 'Teste de Adams e escoliose', 'long_text'),
      field('shoulder_flexibility', 'Flexibilidade dos ombros', 'long_text'),
      field('hamstring_flexibility', 'Flexibilidade de isquiotibiais', 'long_text'),
      field('hip_rotation', 'Rotacao de quadril', 'long_text'),
      field('spine_extension', 'Extensao da coluna', 'long_text'),
      field('movement_limitations', 'Limitacoes de movimento', 'long_text'),
      field('section_static', 'Postura estatica e exames', 'section'),
      field('static_posture', 'Avaliacao postural estatica por regiao', 'long_text'),
      field('complementary_exams', 'Exames complementares', 'long_text'),
      field('goals_set', 'Objetivos tracados', 'long_text'),
      field('final_observations', 'Observacoes finais', 'long_text'),
    ],
  },
];

export function findAssessmentPreset(key: string): AssessmentPreset | undefined {
  return ASSESSMENT_PRESETS.find((preset) => preset.key === key);
}
