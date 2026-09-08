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
    name: 'Anamnese inicial — Pilates',
    description: 'Questionário inicial de saúde, histórico, sintomas, rotina e objetivos. Deve ser respondido pelo aluno antes do início das atividades e revisado por profissional autorizado. Não substitui avaliação ou diagnóstico médico.',
    audience: 'STUDENT',
    fields: [
      field('section_objectives', 'Objetivos e rotina', 'section'),
      field('occupation_routine', 'Qual e sua ocupacao e como e sua rotina habitual de trabalho ou estudo?', 'long_text', { description: 'Informe se passa a maior parte do tempo sentado, em pe, dirigindo, carregando peso, repetindo movimentos ou realizando esforco fisico.', required: true }),
      field('goals', 'Quais são seus principais objetivos com o Pilates?', 'multi_select', { required: true, options: ['Reduzir dores ou desconfortos', 'Melhorar mobilidade ou flexibilidade', 'Aumentar força', 'Melhorar postura e consciência corporal', 'Melhorar equilíbrio e prevenir quedas', 'Melhorar condicionamento e disposição', 'Retornar a atividades diárias', 'Retornar ao esporte', 'Complementar tratamento ou reabilitação', 'Acompanhamento durante gestação ou pós-parto', 'Saúde e bem-estar', 'Outro'] }),
      field('main_expectation', 'Qual é sua principal expectativa ou prioridade para os próximos meses?', 'long_text', { required: true }),
      field('physical_activity', 'Você pratica atualmente alguma atividade física ou exercício?', 'boolean', { required: true }),
      field('physical_activity_details', 'Se pratica atividade física, quais atividades realiza, quantas vezes por semana e qual é a duração aproximada de cada sessão?', 'long_text', { description: 'Se aplicável.' }),
      field('sitting_hours', 'Em média, quantas horas por dia você permanece sentado?', 'number', { unit: 'horas por dia', minimum: 0, maximum: 24 }),
      field('section_health', 'Saúde e segurança para a prática', 'section'),
      field('health_conditions', 'Você possui ou já recebeu diagnóstico de alguma das condições abaixo?', 'multi_select', { required: true, options: ['Nenhuma', 'Hipertensão arterial', 'Doença cardíaca ou cardiovascular', 'Arritmia', 'AVC ou ataque isquêmico transitório', 'Diabetes ou episódios de hipoglicemia', 'Asma ou outra doença respiratória', 'Doença renal', 'Doença neurológica', 'Osteopenia ou osteoporose', 'Artrite, artrose ou doença reumática', 'Hérnia de disco ou outra condição da coluna', 'Escoliose', 'Câncer atual ou anterior', 'Outra condição'], exclusiveOptions: ['Nenhuma'], reviewWhen: { excludes: ['Nenhuma'] } }),
      field('other_health_condition', 'Existe outra condição de saúde, diagnóstico ou acompanhamento profissional que devemos conhecer?', 'long_text', { description: 'Caso não exista, escreva “Nenhum”.', required: true }),
      field('chest_discomfort', 'Atualmente ou nos últimos 12 meses, você sentiu dor, pressão, aperto ou desconforto no peito, em repouso ou durante esforço?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('unusual_breathlessness', 'Atualmente ou nos últimos 12 meses, você apresentou falta de ar incomum ou desproporcional ao esforço realizado?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('fainting', 'Atualmente ou nos últimos 12 meses, você apresentou tontura intensa, perda de equilíbrio, desmaio ou sensação de que iria desmaiar?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('palpitations', 'Você apresenta palpitações, batimentos irregulares ou coração acelerado acompanhado de mal-estar, tontura, falta de ar ou dor no peito?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('exercise_restriction', 'Algum profissional de saúde já recomendou restrição, supervisão especial ou autorização antes da prática de exercícios?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('restriction_details', 'Se recebeu alguma recomendação ou restrição, descreva-a.', 'long_text'),
      field('medications', 'Quais medicamentos você utiliza atualmente, mesmo que apenas ocasionalmente?', 'long_text', { description: 'Se souber, informe nome, finalidade e frequência. Caso não utilize, escreva “Nenhum”.', required: true }),
      field('allergies', 'Você possui alguma alergia ou já teve reação importante a medicamento, alimento, material ou substância?', 'long_text', { description: 'Descreva a alergia ou escreva “Nenhuma”.', required: true }),
      field('procedures', 'Você já passou por cirurgia, internação ou procedimento importante?', 'long_text', { description: 'Informe qual procedimento, região do corpo e data aproximada. Caso não tenha passado, escreva “Nenhum”.', required: true }),
      field('pregnancy_status', 'Alguma das situações abaixo se aplica atualmente?', 'single_select', { required: true, options: ['Não se aplica', 'Gestação', 'Pós-parto há menos de 6 meses', 'Pós-parto entre 6 e 12 meses', 'Tentativa de engravidar ou tratamento de fertilidade', 'Prefiro não responder'], reviewWhen: { includesAny: ['Gestação', 'Pós-parto há menos de 6 meses', 'Pós-parto entre 6 e 12 meses'] } }),
      field('acute_symptoms', 'Você está atualmente com febre, infecção, doença aguda, lesão recente ou piora importante de algum sintoma?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('section_pain', 'Dor, movimento e histórico de lesões', 'section'),
      field('has_pain', 'Você sente atualmente alguma dor ou desconforto físico?', 'boolean', { required: true }),
      field('pain_regions', 'Em quais regiões você sente dor ou desconforto?', 'multi_select', { options: ['Cabeça ou face', 'Pescoço', 'Ombro direito', 'Ombro esquerdo', 'Braço, cotovelo, punho ou mão', 'Região torácica', 'Região lombar', 'Quadril ou pelve', 'Virilha', 'Joelho direito', 'Joelho esquerdo', 'Perna, tornozelo ou pé', 'Dor generalizada', 'Outra região', 'Não se aplica'], exclusiveOptions: ['Não se aplica'] }),
      field('pain_intensity', 'Qual e a intensidade atual da sua principal dor?', 'pain_scale', { description: '0 significa nenhuma dor e 10 significa a pior dor imaginavel.', minimum: 0, maximum: 10, reviewWhen: { minimum: 7 } }),
      field('pain_onset', 'Quando essa dor ou desconforto começou e há quanto tempo está presente?', 'short_text'),
      field('pain_manifestation', 'Como essa dor ou desconforto costuma se manifestar?', 'multi_select', { options: ['Durante movimentos', 'Depois de atividade física', 'Em repouso', 'Durante a noite ou interrompendo o sono', 'Ao acordar', 'Constante', 'Intermitente', 'Rigidez', 'Queimação', 'Pontada', 'Pressão ou peso', 'Não se aplica', 'Outro'], reviewWhen: { includesAny: ['Em repouso', 'Durante a noite ou interrompendo o sono', 'Constante'] } }),
      field('pain_symptoms', 'A dor é acompanhada por algum destes sintomas?', 'multi_select', { options: ['Irradiação para outra região', 'Dormência', 'Formigamento', 'Perda ou redução de força', 'Inchaço', 'Travamento articular', 'Estalos acompanhados de dor', 'Nenhum', 'Não se aplica', 'Outro'], exclusiveOptions: ['Nenhum', 'Não se aplica'], reviewWhen: { includesAny: ['Irradiação para outra região', 'Dormência', 'Formigamento', 'Perda ou redução de força'] } }),
      field('pain_worse', 'Quais movimentos, posicoes ou atividades pioram sua dor?', 'long_text'),
      field('pain_better', 'Quais movimentos, posicoes ou cuidados aliviam sua dor?', 'long_text'),
      field('limited_activities', 'Quais atividades importantes do seu cotidiano estao dificeis ou deixaram de ser realizadas?', 'long_text', { description: 'Exemplos: caminhar, subir escadas, dormir, trabalhar, dirigir, levantar objetos, cuidar da casa ou praticar esporte.' }),
      field('injuries', 'Você já teve lesão, queda, fratura, luxação, entorse ou acidente relevante?', 'long_text', { description: 'Informe a região afetada, o que aconteceu e a data aproximada. Caso não tenha ocorrido, escreva “Nenhum”.', required: true }),
      field('previous_treatment', 'Você já realizou exames, recebeu diagnóstico ou fez tratamento relacionado à sua queixa atual?', 'long_text', { description: 'Informe exames, diagnósticos, fisioterapia, cirurgia, infiltração ou outros tratamentos. Caso não tenha realizado, escreva “Nenhum”.', required: true }),
      field('falls', 'Nos últimos 12 meses, você sofreu queda ou passou a ter medo de cair?', 'single_select', { required: true, options: ['Não', 'Sofri uma queda', 'Sofri mais de uma queda', 'Tenho medo de cair, mesmo sem ter caído', 'Sofri queda e tenho medo de cair'], reviewWhen: { excludes: ['Não'] } }),
      field('assistive_devices', 'Você utiliza bengala, muleta, andador, órtese, prótese ou precisa de auxílio para algum movimento?', 'long_text', { description: 'Descreva o recurso ou escreva “Nenhum”.', required: true }),
      field('section_wellbeing', 'Habitos e bem-estar', 'section'),
      field('sleep_hours', 'Quantas horas você dorme, em média, por noite?', 'number', { unit: 'horas', minimum: 0, maximum: 24, required: true }),
      field('sleep_quality', 'Como você avalia a qualidade do seu sono?', 'numeric_scale', { minimum: 1, maximum: 5, required: true, description: '1 Muito ruim · 2 Ruim · 3 Regular · 4 Boa · 5 Muito boa' }),
      field('stress', 'Quanto o estresse, a ansiedade ou o estado emocional tem afetado seu bem-estar ou suas atividades?', 'numeric_scale', { minimum: 0, maximum: 10, description: '0 significa que não afetam e 10 significa que afetam intensamente.' }),
      field('nicotine', 'Você fuma ou utiliza nicotina?', 'single_select', { required: true, options: ['Nunca utilizei', 'Não utilizo atualmente', 'Utilizo ocasionalmente', 'Utilizo diariamente', 'Prefiro não responder'] }),
      field('alcohol', 'Com que frequência você consome bebidas alcoólicas?', 'single_select', { required: true, options: ['Nunca', 'Menos de uma vez por semana', 'Uma ou duas vezes por semana', 'Três ou mais vezes por semana', 'Prefiro não responder'] }),
      field('nutrition', 'Existe alguma informação relevante sobre alimentação, hidratação ou restrição alimentar que o profissional deva considerar?', 'long_text', { description: 'Se aplicável.' }),
      field('pelvic_symptoms', 'Você apresenta algum sintoma intestinal, urinário ou relacionado ao assoalho pélvico que possa ser importante para a prática?', 'multi_select', { options: ['Constipação frequente', 'Urgência intestinal', 'Perda involuntaria de fezes', 'Urgência urinária', 'Perda de urina ao tossir, espirrar, saltar ou fazer esforço', 'Aumento importante da frequência urinária', 'Dificuldade para urinar', 'Sensação de peso ou pressão pélvica', 'Dor pélvica', 'Nenhum', 'Prefiro não responder', 'Outro'], exclusiveOptions: ['Nenhum', 'Prefiro não responder'] }),
      field('truth_declaration', 'Você confirma que respondeu este formulário de forma verdadeira e compreende que ele não substitui avaliação médica, fisioterapêutica ou de outro profissional de saúde?', 'boolean', { required: true }),
    ],
  },
  {
    key: 'physical_evaluation',
    name: 'Avaliação física',
    description: 'Modelo editável para preenchimento por profissional autorizado. Não é protocolo diagnóstico.',
    audience: 'PROFESSIONAL',
    fields: [
      field('section_initial', 'Inicio e postura dinamica', 'section'),
      field('initial_goals_observations', 'Objetivos e observações iniciais', 'long_text'),
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
