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
    description: 'Questionario inicial de saude, historico, sintomas, rotina e objetivos. Deve ser respondido pelo aluno antes do inicio das atividades e revisado por profissional autorizado. Nao substitui avaliacao ou diagnostico medico.',
    audience: 'STUDENT',
    fields: [
      field('section_objectives', 'Objetivos e rotina', 'section'),
      field('occupation_routine', 'Qual e sua ocupacao e como e sua rotina habitual de trabalho ou estudo?', 'long_text', { description: 'Informe se passa a maior parte do tempo sentado, em pe, dirigindo, carregando peso, repetindo movimentos ou realizando esforco fisico.', required: true }),
      field('goals', 'Quais sao seus principais objetivos com o Pilates?', 'multi_select', { required: true, options: ['Reduzir dores ou desconfortos', 'Melhorar mobilidade ou flexibilidade', 'Aumentar forca', 'Melhorar postura e consciencia corporal', 'Melhorar equilibrio e prevenir quedas', 'Melhorar condicionamento e disposicao', 'Retornar a atividades diarias', 'Retornar ao esporte', 'Complementar tratamento ou reabilitacao', 'Acompanhamento durante gestacao ou pos-parto', 'Saude e bem-estar', 'Outro'] }),
      field('main_expectation', 'Qual e sua principal expectativa ou prioridade para os proximos meses?', 'long_text', { required: true }),
      field('physical_activity', 'Voce pratica atualmente alguma atividade fisica ou exercicio?', 'boolean', { required: true }),
      field('physical_activity_details', 'Se pratica atividade fisica, quais atividades realiza, quantas vezes por semana e qual e a duracao aproximada de cada sessao?', 'long_text', { description: 'Se aplicavel.' }),
      field('sitting_hours', 'Em media, quantas horas por dia voce permanece sentado?', 'number', { unit: 'horas por dia', minimum: 0, maximum: 24 }),
      field('section_health', 'Saude e seguranca para a pratica', 'section'),
      field('health_conditions', 'Voce possui ou ja recebeu diagnostico de alguma das condicoes abaixo?', 'multi_select', { required: true, options: ['Nenhuma', 'Hipertensao arterial', 'Doenca cardiaca ou cardiovascular', 'Arritmia', 'AVC ou ataque isquemico transitorio', 'Diabetes ou episodios de hipoglicemia', 'Asma ou outra doenca respiratoria', 'Doenca renal', 'Doenca neurologica', 'Osteopenia ou osteoporose', 'Artrite, artrose ou doenca reumatica', 'Hernia de disco ou outra condicao da coluna', 'Escoliose', 'Cancer atual ou anterior', 'Outra condicao'], exclusiveOptions: ['Nenhuma'], reviewWhen: { excludes: ['Nenhuma'] } }),
      field('other_health_condition', 'Existe outra condicao de saude, diagnostico ou acompanhamento profissional que devemos conhecer?', 'long_text', { description: 'Caso nao exista, escreva “Nenhum”.', required: true }),
      field('chest_discomfort', 'Atualmente ou nos ultimos 12 meses, voce sentiu dor, pressao, aperto ou desconforto no peito, em repouso ou durante esforco?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('unusual_breathlessness', 'Atualmente ou nos ultimos 12 meses, voce apresentou falta de ar incomum ou desproporcional ao esforco realizado?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('fainting', 'Atualmente ou nos ultimos 12 meses, voce apresentou tontura intensa, perda de equilibrio, desmaio ou sensacao de que iria desmaiar?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('palpitations', 'Voce apresenta palpitacoes, batimentos irregulares ou coracao acelerado acompanhado de mal-estar, tontura, falta de ar ou dor no peito?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('exercise_restriction', 'Algum profissional de saude ja recomendou restricao, supervisao especial ou autorizacao antes da pratica de exercicios?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('restriction_details', 'Se recebeu alguma recomendacao ou restricao, descreva-a.', 'long_text'),
      field('medications', 'Quais medicamentos voce utiliza atualmente, mesmo que apenas ocasionalmente?', 'long_text', { description: 'Se souber, informe nome, finalidade e frequencia. Caso nao utilize, escreva “Nenhum”.', required: true }),
      field('allergies', 'Voce possui alguma alergia ou ja teve reacao importante a medicamento, alimento, material ou substancia?', 'long_text', { description: 'Descreva a alergia ou escreva “Nenhuma”.', required: true }),
      field('procedures', 'Voce ja passou por cirurgia, internacao ou procedimento importante?', 'long_text', { description: 'Informe qual procedimento, regiao do corpo e data aproximada. Caso nao tenha passado, escreva “Nenhum”.', required: true }),
      field('pregnancy_status', 'Alguma das situacoes abaixo se aplica atualmente?', 'single_select', { required: true, options: ['Nao se aplica', 'Gestacao', 'Pos-parto ha menos de 6 meses', 'Pos-parto entre 6 e 12 meses', 'Tentativa de engravidar ou tratamento de fertilidade', 'Prefiro nao responder'], reviewWhen: { includesAny: ['Gestacao', 'Pos-parto ha menos de 6 meses', 'Pos-parto entre 6 e 12 meses'] } }),
      field('acute_symptoms', 'Voce esta atualmente com febre, infeccao, doenca aguda, lesao recente ou piora importante de algum sintoma?', 'boolean', { required: true, reviewWhen: { equals: true } }),
      field('section_pain', 'Dor, movimento e historico de lesoes', 'section'),
      field('has_pain', 'Voce sente atualmente alguma dor ou desconforto fisico?', 'boolean', { required: true }),
      field('pain_regions', 'Em quais regioes voce sente dor ou desconforto?', 'multi_select', { options: ['Cabeca ou face', 'Pescoco', 'Ombro direito', 'Ombro esquerdo', 'Braco, cotovelo, punho ou mao', 'Regiao toracica', 'Regiao lombar', 'Quadril ou pelve', 'Virilha', 'Joelho direito', 'Joelho esquerdo', 'Perna, tornozelo ou pe', 'Dor generalizada', 'Outra regiao', 'Nao se aplica'], exclusiveOptions: ['Nao se aplica'] }),
      field('pain_intensity', 'Qual e a intensidade atual da sua principal dor?', 'pain_scale', { description: '0 significa nenhuma dor e 10 significa a pior dor imaginavel.', minimum: 0, maximum: 10, reviewWhen: { minimum: 7 } }),
      field('pain_onset', 'Quando essa dor ou desconforto comecou e ha quanto tempo esta presente?', 'short_text'),
      field('pain_manifestation', 'Como essa dor ou desconforto costuma se manifestar?', 'multi_select', { options: ['Durante movimentos', 'Depois de atividade fisica', 'Em repouso', 'Durante a noite ou interrompendo o sono', 'Ao acordar', 'Constante', 'Intermitente', 'Rigidez', 'Queimacao', 'Pontada', 'Pressao ou peso', 'Nao se aplica', 'Outro'], reviewWhen: { includesAny: ['Em repouso', 'Durante a noite ou interrompendo o sono', 'Constante'] } }),
      field('pain_symptoms', 'A dor e acompanhada por algum destes sintomas?', 'multi_select', { options: ['Irradiacao para outra regiao', 'Dormencia', 'Formigamento', 'Perda ou reducao de forca', 'Inchaco', 'Travamento articular', 'Estalos acompanhados de dor', 'Nenhum', 'Nao se aplica', 'Outro'], exclusiveOptions: ['Nenhum', 'Nao se aplica'], reviewWhen: { includesAny: ['Irradiacao para outra regiao', 'Dormencia', 'Formigamento', 'Perda ou reducao de forca'] } }),
      field('pain_worse', 'Quais movimentos, posicoes ou atividades pioram sua dor?', 'long_text'),
      field('pain_better', 'Quais movimentos, posicoes ou cuidados aliviam sua dor?', 'long_text'),
      field('limited_activities', 'Quais atividades importantes do seu cotidiano estao dificeis ou deixaram de ser realizadas?', 'long_text', { description: 'Exemplos: caminhar, subir escadas, dormir, trabalhar, dirigir, levantar objetos, cuidar da casa ou praticar esporte.' }),
      field('injuries', 'Voce ja teve lesao, queda, fratura, luxacao, entorse ou acidente relevante?', 'long_text', { description: 'Informe a regiao afetada, o que aconteceu e a data aproximada. Caso nao tenha ocorrido, escreva “Nenhum”.', required: true }),
      field('previous_treatment', 'Voce ja realizou exames, recebeu diagnostico ou fez tratamento relacionado a sua queixa atual?', 'long_text', { description: 'Informe exames, diagnosticos, fisioterapia, cirurgia, infiltracao ou outros tratamentos. Caso nao tenha realizado, escreva “Nenhum”.', required: true }),
      field('falls', 'Nos ultimos 12 meses, voce sofreu queda ou passou a ter medo de cair?', 'single_select', { required: true, options: ['Nao', 'Sofri uma queda', 'Sofri mais de uma queda', 'Tenho medo de cair, mesmo sem ter caido', 'Sofri queda e tenho medo de cair'], reviewWhen: { excludes: ['Nao'] } }),
      field('assistive_devices', 'Voce utiliza bengala, muleta, andador, ortese, protese ou precisa de auxilio para algum movimento?', 'long_text', { description: 'Descreva o recurso ou escreva “Nenhum”.', required: true }),
      field('section_wellbeing', 'Habitos e bem-estar', 'section'),
      field('sleep_hours', 'Quantas horas voce dorme, em media, por noite?', 'number', { unit: 'horas', minimum: 0, maximum: 24, required: true }),
      field('sleep_quality', 'Como voce avalia a qualidade do seu sono?', 'numeric_scale', { minimum: 1, maximum: 5, required: true, description: '1 Muito ruim · 2 Ruim · 3 Regular · 4 Boa · 5 Muito boa' }),
      field('stress', 'Quanto o estresse, a ansiedade ou o estado emocional tem afetado seu bem-estar ou suas atividades?', 'numeric_scale', { minimum: 0, maximum: 10, description: '0 significa que nao afetam e 10 significa que afetam intensamente.' }),
      field('nicotine', 'Voce fuma ou utiliza nicotina?', 'single_select', { required: true, options: ['Nunca utilizei', 'Nao utilizo atualmente', 'Utilizo ocasionalmente', 'Utilizo diariamente', 'Prefiro nao responder'] }),
      field('alcohol', 'Com que frequencia voce consome bebidas alcoolicas?', 'single_select', { required: true, options: ['Nunca', 'Menos de uma vez por semana', 'Uma ou duas vezes por semana', 'Tres ou mais vezes por semana', 'Prefiro nao responder'] }),
      field('nutrition', 'Existe alguma informacao relevante sobre alimentacao, hidratacao ou restricao alimentar que o profissional deva considerar?', 'long_text', { description: 'Se aplicavel.' }),
      field('pelvic_symptoms', 'Voce apresenta algum sintoma intestinal, urinario ou relacionado ao assoalho pelvico que possa ser importante para a pratica?', 'multi_select', { options: ['Constipacao frequente', 'Urgencia intestinal', 'Perda involuntaria de fezes', 'Urgencia urinaria', 'Perda de urina ao tossir, espirrar, saltar ou fazer esforco', 'Aumento importante da frequencia urinaria', 'Dificuldade para urinar', 'Sensacao de peso ou pressao pelvica', 'Dor pelvica', 'Nenhum', 'Prefiro nao responder', 'Outro'], exclusiveOptions: ['Nenhum', 'Prefiro nao responder'] }),
      field('truth_declaration', 'Voce confirma que respondeu este formulario de forma verdadeira e compreende que ele nao substitui avaliacao medica, fisioterapeutica ou de outro profissional de saude?', 'boolean', { required: true }),
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
