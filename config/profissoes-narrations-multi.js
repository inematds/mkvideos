/**
 * Narrativas multi-estilo para A/B testing CriaProf-CTA-916.
 * 5 estilos narrativos × 90 profissões via template + milestones por categoria.
 *
 * Uso: const { getNarration } = require('./profissoes-narrations-multi');
 *      getNarration('fisioterapeuta', 3)
 *      → 'Pensa rápido: quantas vezes essa profissão mudou...'
 */

// === Milestones por categoria ===
// tool_journey: "do X ao Y. Do A ao B." — usado em v2, v4, v5
// items:        lista separada por vírgula — usada em v1, v3
// identity:     "a/o que X" — usado em v1, v4
// action:       verbo de ação no passado — usado em v1

const MILESTONES = {
  saude: {
    tool_journey: 'Do papel ao prontuário digital. Da consulta presencial à telemedicina.',
    items: 'prontuário de papel, equipamento manual, consulta presencial, telemedicina',
    identity: 'a que cuida',
    action: 'cuidou e adaptou protocolos',
  },
  saude_manual: {
    tool_journey: 'Do manual ao digital. Da técnica presencial à orientação remota.',
    items: 'técnica manual, equipamento analógico, prontuário em papel, atendimento remoto',
    identity: 'a que cuida e transforma',
    action: 'cuidou com as mãos e se reinventou',
  },
  educacao: {
    tool_journey: 'Do quadro negro ao digital. Da sala presencial ao EAD.',
    items: 'quadro negro, apostila impressa, plataforma digital, aula remota',
    identity: 'a que transforma vidas',
    action: 'ensinou e adaptou metodologias',
  },
  juridico: {
    tool_journey: 'Do processo físico ao digital. Da petição em papel ao sistema eletrônico.',
    items: 'processo físico, pesquisa em livros, petição em papel, sistema eletrônico',
    identity: 'a que defende',
    action: 'lutou e estudou cada mudança',
  },
  financeiro: {
    tool_journey: 'Da planilha manual ao ERP. Do papel ao sistema financeiro integrado.',
    items: 'planilha manual, papel-moeda, balanço em papel, sistema ERP integrado',
    identity: 'o que organiza o futuro',
    action: 'calculou e se adaptou a cada norma',
  },
  tech: {
    tool_journey: 'Do código manual ao DevOps. Do servidor físico ao cloud.',
    items: 'código manual, servidor físico, CD/DVD, cloud e containers',
    identity: 'o que constrói o futuro',
    action: 'programou e aprendeu cada nova stack',
  },
  criativo: {
    tool_journey: 'Do analógico ao digital. Do trabalho presencial ao colaborativo online.',
    items: 'ferramentas analógicas, trabalho presencial, software básico, colaboração online',
    identity: 'o que cria',
    action: 'criou e se reinventou a cada era',
  },
  oficios: {
    tool_journey: 'Do manual ao computadorizado. Do analógico ao digital.',
    items: 'ferramentas manuais, maquinário analógico, sistema computadorizado, tecnologia digital',
    identity: 'o que constrói',
    action: 'construiu e aprendeu cada nova ferramenta',
  },
  servicos: {
    tool_journey: 'Do caderno de pedidos ao app. Do atendimento pessoal ao digital.',
    items: 'caderno de pedidos, telefone fixo, máquina de cartão, app de delivery',
    identity: 'o que serve com excelência',
    action: 'atendeu e se adaptou a cada mudança',
  },
  transporte: {
    tool_journey: 'Do mapa físico ao GPS. Do rádio ao app de rastreamento.',
    items: 'mapa físico, rádio comunicador, GPS básico, app de rastreamento',
    identity: 'o que move o Brasil',
    action: 'dirigiu e navegou cada nova tecnologia',
  },
  rural: {
    tool_journey: 'Do cultivo manual ao precision farming. Do caderno ao sistema digital.',
    items: 'cultivo manual, caderno de campo, máquina básica, sistema de precision farming',
    identity: 'o que alimenta o Brasil',
    action: 'cultivou e se adaptou a cada safra',
  },
};

// === Categoria por profissão ===
const CATEGORY = {
  // Saúde — atendimento clínico direto
  'fisioterapeuta':          'saude_manual',
  'crianca-medica':          'saude',
  'enfermeira':              'saude',
  'psicologa':               'saude',
  'dentista':                'saude_manual',
  'farmaceutica':            'saude',
  'nutricionista':           'saude',
  'fonoaudiologa':           'saude_manual',
  'terapeuta-ocupacional':   'saude_manual',
  'biomedica':               'saude',
  'cardiologista':           'saude',
  'pediatra':                'saude',
  'ginecologista':           'saude',
  'veterinario':             'saude_manual',
  'massoterapeuta':          'saude_manual',
  'parteira':                'saude_manual',
  'ortopedista':             'saude_manual',
  'oftalmologista':          'saude',
  'psiquiatra':              'saude',
  'dermatologista':          'saude',
  'personal-trainer':        'saude_manual',
  // Educação
  'professora-fundamental':  'educacao',
  'professora-medio':        'educacao',
  'pedagoga':                'educacao',
  'educacao-infantil':       'educacao',
  'psicopedagoga':           'educacao',
  'professor-universitario': 'educacao',
  'professor-matematica':    'educacao',
  'educador-fisico':         'educacao',
  'bibliotecaria':           'educacao',
  'coordenador-escolar':     'educacao',
  'professor-danca':         'educacao',
  // Jurídico / Segurança Pública
  'advogada':                'juridico',
  'juiza':                   'juridico',
  'delegada':                'juridico',
  // Financeiro / Admin
  'contador':                'financeiro',
  'secretaria':              'financeiro',
  'administrador':           'financeiro',
  'analista-rh':             'financeiro',
  'auditor-fiscal':          'financeiro',
  'consultor-financeiro':    'financeiro',
  'gerente-banco':           'financeiro',
  'corretor-imoveis':        'financeiro',
  'vendedor':                'financeiro',
  'empresario':              'financeiro',
  'gerente-projeto':         'financeiro',
  // Tech
  'programador':             'tech',
  'analista-sistemas':       'tech',
  'designer-ux':             'tech',
  'especialista-cybersec':   'tech',
  // Criativo / Comunicação
  'fotografo':               'criativo',
  'jornalista':              'criativo',
  'arquiteta':               'criativo',
  'musico':                  'criativo',
  'ator':                    'criativo',
  'escritor':                'criativo',
  'animador':                'criativo',
  'dj-produtor':             'criativo',
  // Beleza / Estética
  'cabeleireira':            'servicos',
  'maquiadora':              'servicos',
  'florista':                'servicos',
  'confeiteiro':             'servicos',
  'chef':                    'servicos',
  'barbeiro':                'servicos',
  // Ofícios / Construção
  'eletricista':             'oficios',
  'encanador':               'oficios',
  'mecanico':                'oficios',
  'marceneiro':              'oficios',
  'costureira':              'oficios',
  'soldador':                'oficios',
  'pintor':                  'oficios',
  'pedreiro':                'oficios',
  'sapateiro':               'oficios',
  'relojoeiro':              'oficios',
  'serralheiro':             'oficios',
  'vidraceiro':              'oficios',
  'torneiro-mecanico':       'oficios',
  'funileiro':               'oficios',
  // Transporte
  'caminhoneiro':            'transporte',
  'piloto':                  'transporte',
  'controlador-aereo':       'transporte',
  'motorista-app':           'transporte',
  // Serviços
  'garcom':                  'servicos',
  'porteiro':                'servicos',
  // Rural / Ambiental
  'agronomo':                'rural',
  'biologo-ambiental':       'rural',
  'pescador':                'rural',
  'apicultor':               'rural',
  'produtor-rural':          'rural',
  'guarda-florestal':        'rural',
};

// === Templates dos 5 estilos ===
// {tool_journey}, {items}, {identity}, {action} são substituídos pelos milestones da categoria

function buildNarration(version, m) {
  switch (String(version)) {
    case '1':
      return `Você lembra quando tudo era manual? Você ${m.action}, aprendeu ${m.items}. Cada onda você adaptou. Agora a IA chegou. E você? Continua sendo ${m.identity}. Inema ponto CLUB te espera.`;
    case '2':
      return `Lembra como tudo era diferente quando você começou? ${m.tool_journey} Sempre que mudou, você mudou junto. Agora a IA chegou — e você já sabe o que fazer. Continue aprendendo no Inema ponto CLUB.`;
    case '3':
      return `Pensa rápido: quantas vezes essa profissão mudou desde que você começou? ${m.items.charAt(0).toUpperCase() + m.items.slice(1)}. Você sempre adaptou. Agora chegou a IA. Você sabe o que fazer. Continue aprendendo no Inema ponto CLUB.`;
    case '4':
      return `Você consegue lembrar quantas vezes essa profissão se reinventou? ${m.tool_journey} Cada vez você esteve lá. Agora é a IA. E você já sabe: continua sendo ${m.identity}. Inema ponto CLUB.`;
    case '5':
      return `E se eu te disser que você já viveu isso antes? Você passou por tudo: ${m.tool_journey} Cada vez você adaptou. Agora a IA chegou. Você sabe. Continue aprendendo no Inema ponto CLUB.`;
    default:
      throw new Error(`Versão inválida: ${version}. Use 1-5.`);
  }
}

/**
 * Retorna a narração para um slug e versão.
 * @param {string} slug - ex: 'fisioterapeuta'
 * @param {number|string} version - 1 a 5
 * @returns {string} texto da narração (sem prefixo — prefixo é adicionado pelo render)
 */
function getNarration(slug, version) {
  const cat = CATEGORY[slug] || 'servicos';
  const m = MILESTONES[cat];
  if (!m) throw new Error(`Categoria não encontrada para slug: ${slug}`);
  return buildNarration(version, m);
}

/**
 * Retorna narração completa com prefixo de hook incluso.
 * @param {string} slug
 * @param {string} variant - 'prof' | 'generic'
 * @param {number|string} version - 1 a 5
 * @param {string} narrPrefix - ex: 'A fisioterapia mudou. E agora?'
 */
function getFullNarration(slug, variant, version, narrPrefix) {
  return `${narrPrefix} ${getNarration(slug, version)}`;
}

module.exports = { getNarration, getFullNarration, CATEGORY, MILESTONES };
