/**
 * Mapping de profissão → noun (visual hook) e prefix de narração.
 *
 * Usado por render-criaprof-cta-916.js e batch-criaprof-cta.js.
 * NÃO modifica config/profissoes-30.js — apenas adiciona overlay visual + narração.
 *
 * - hookVisual: 2 linhas para o cabeçalho 0-3s (linha 1 = noun caps, linha 2 fixa "MUDOU. E AGORA?")
 * - narrPrefix: frase prepended à narr_criaprof original ("A fisioterapia mudou. E agora? <resto>")
 */

const NOUNS = {
  // Saúde básica
  'fisioterapeuta':         { noun: 'FISIOTERAPIA',         prefix: 'A fisioterapia' },
  'crianca-medica':         { noun: 'MEDICINA',             prefix: 'A medicina' },
  'enfermeira':             { noun: 'ENFERMAGEM',           prefix: 'A enfermagem' },
  'psicologa':              { noun: 'PSICOLOGIA',           prefix: 'A psicologia' },
  'dentista':               { noun: 'ODONTOLOGIA',          prefix: 'A odontologia' },
  'farmaceutica':           { noun: 'FARMÁCIA',             prefix: 'A farmácia' },
  'nutricionista':          { noun: 'NUTRIÇÃO',             prefix: 'A nutrição' },
  'fonoaudiologa':          { noun: 'FONOAUDIOLOGIA',       prefix: 'A fonoaudiologia' },
  'terapeuta-ocupacional':  { noun: 'TERAPIA OCUPACIONAL',  prefix: 'A terapia ocupacional' },
  'biomedica':              { noun: 'BIOMEDICINA',          prefix: 'A biomedicina' },

  // Educação
  'professora-fundamental': { noun: 'EDUCAR',               prefix: 'Educar' },
  'professora-medio':       { noun: 'ENSINAR',              prefix: 'Ensinar' },
  'pedagoga':               { noun: 'PEDAGOGIA',            prefix: 'A pedagogia' },
  'educacao-infantil':      { noun: 'EDUCAÇÃO INFANTIL',    prefix: 'A educação infantil' },
  'psicopedagoga':          { noun: 'PSICOPEDAGOGIA',       prefix: 'A psicopedagogia' },

  // Escritório
  'contador':               { noun: 'CONTABILIDADE',        prefix: 'A contabilidade' },
  'advogada':               { noun: 'ADVOCACIA',            prefix: 'A advocacia' },
  'secretaria':             { noun: 'SECRETARIADO',         prefix: 'O secretariado' },
  'administrador':          { noun: 'ADMINISTRAÇÃO',        prefix: 'A administração' },
  'analista-rh':            { noun: 'RH',                   prefix: 'O RH' },

  // Ofícios
  'eletricista':            { noun: 'ELETRICIDADE',         prefix: 'Ser eletricista' },
  'encanador':              { noun: 'ENCANAMENTO',          prefix: 'Ser encanador' },
  'mecanico':               { noun: 'MECÂNICA',             prefix: 'A mecânica' },
  'marceneiro':             { noun: 'MARCENARIA',           prefix: 'A marcenaria' },
  'costureira':             { noun: 'COSTURA',              prefix: 'A costura' },

  // Serviço/criativo
  'cabeleireira':           { noun: 'CABELEIREIRO',         prefix: 'Ser cabeleireira' },
  'chef':                   { noun: 'GASTRONOMIA',          prefix: 'A gastronomia' },
  'fotografo':              { noun: 'FOTOGRAFIA',           prefix: 'A fotografia' },
  'jornalista':             { noun: 'JORNALISMO',           prefix: 'O jornalismo' },
  'arquiteta':              { noun: 'ARQUITETURA',          prefix: 'A arquitetura' },

  // Saúde especializada
  'cardiologista':          { noun: 'CARDIOLOGIA',          prefix: 'A cardiologia' },
  'pediatra':               { noun: 'PEDIATRIA',            prefix: 'A pediatria' },
  'ginecologista':          { noun: 'GINECOLOGIA',          prefix: 'A ginecologia' },
  'veterinario':            { noun: 'VETERINÁRIA',          prefix: 'A veterinária' },
  'massoterapeuta':         { noun: 'MASSOTERAPIA',         prefix: 'A massoterapia' },
  'parteira':               { noun: 'OBSTETRÍCIA',          prefix: 'A obstetrícia' },

  // Educação superior
  'professor-universitario':{ noun: 'DOCÊNCIA',             prefix: 'A docência' },
  'professor-matematica':   { noun: 'MATEMÁTICA',           prefix: 'Ensinar matemática' },
  'educador-fisico':        { noun: 'EDUCAÇÃO FÍSICA',      prefix: 'A educação física' },
  'bibliotecaria':          { noun: 'BIBLIOTECONOMIA',      prefix: 'A biblioteconomia' },
  'coordenador-escolar':    { noun: 'GESTÃO ESCOLAR',       prefix: 'A gestão escolar' },

  // Direito/Finanças
  'juiza':                  { noun: 'MAGISTRATURA',         prefix: 'A magistratura' },
  'delegada':               { noun: 'INVESTIGAÇÃO',         prefix: 'A investigação' },
  'auditor-fiscal':         { noun: 'AUDITORIA',            prefix: 'A auditoria' },
  'consultor-financeiro':   { noun: 'FINANÇAS',             prefix: 'A consultoria financeira' },

  // Ofícios 2
  'soldador':               { noun: 'SOLDAGEM',             prefix: 'A soldagem' },
  'pintor':                 { noun: 'PINTURA',              prefix: 'A pintura' },
  'pedreiro':               { noun: 'CONSTRUÇÃO',           prefix: 'Ser pedreiro' },
  'sapateiro':              { noun: 'SAPATARIA',            prefix: 'Ser sapateiro' },
  'relojoeiro':             { noun: 'RELOJOARIA',           prefix: 'Ser relojoeiro' },

  // Transporte
  'caminhoneiro':           { noun: 'A ESTRADA',            prefix: 'A estrada' },
  'piloto':                 { noun: 'AVIAÇÃO',              prefix: 'A aviação' },
  'controlador-aereo':      { noun: 'CONTROLE AÉREO',       prefix: 'O controle aéreo' },

  // Beleza/Criativo 2
  'maquiadora':             { noun: 'MAQUIAGEM',            prefix: 'A maquiagem' },
  'florista':               { noun: 'FLORICULTURA',         prefix: 'A floricultura' },
  'confeiteiro':            { noun: 'CONFEITARIA',          prefix: 'A confeitaria' },
  'dj-produtor':            { noun: 'PRODUÇÃO MUSICAL',     prefix: 'A produção musical' },

  // Rural
  'agronomo':               { noun: 'AGRONOMIA',            prefix: 'A agronomia' },
  'biologo-ambiental':      { noun: 'BIOLOGIA',             prefix: 'A biologia' },
  'pescador':               { noun: 'PESCA',                prefix: 'A pesca' },

  // Saúde especializada 2
  'ortopedista':            { noun: 'ORTOPEDIA',            prefix: 'A ortopedia' },
  'oftalmologista':         { noun: 'OFTALMOLOGIA',         prefix: 'A oftalmologia' },
  'psiquiatra':             { noun: 'PSIQUIATRIA',          prefix: 'A psiquiatria' },
  'dermatologista':         { noun: 'DERMATOLOGIA',         prefix: 'A dermatologia' },
  'personal-trainer':       { noun: 'PERSONAL TRAINING',    prefix: 'Ser personal trainer' },

  // Tech
  'programador':            { noun: 'PROGRAMAÇÃO',          prefix: 'A programação' },
  'analista-sistemas':      { noun: 'ANÁLISE DE SISTEMAS',  prefix: 'A análise de sistemas' },
  'designer-ux':            { noun: 'UX DESIGN',            prefix: 'O UX design' },
  'gerente-projeto':        { noun: 'GESTÃO DE PROJETOS',   prefix: 'A gestão de projetos' },
  'especialista-cybersec':  { noun: 'CYBERSEGURANÇA',       prefix: 'A cibersegurança' },

  // Finanças 2
  'gerente-banco':          { noun: 'O BANCÁRIO',           prefix: 'O setor bancário' },
  'corretor-imoveis':       { noun: 'CORRETAGEM',           prefix: 'A corretagem' },
  'vendedor':               { noun: 'VENDAS',               prefix: 'Vender' },
  'empresario':             { noun: 'EMPREENDER',           prefix: 'Empreender' },

  // Artes
  'musico':                 { noun: 'MÚSICA',               prefix: 'A música' },
  'ator':                   { noun: 'ATUAÇÃO',              prefix: 'A atuação' },
  'professor-danca':        { noun: 'DANÇA',                prefix: 'A dança' },
  'escritor':               { noun: 'ESCRITA',              prefix: 'A escrita' },
  'animador':               { noun: 'ANIMAÇÃO',             prefix: 'A animação' },

  // Ofícios 3
  'serralheiro':            { noun: 'SERRALHERIA',          prefix: 'A serralheria' },
  'vidraceiro':             { noun: 'VIDRAÇARIA',           prefix: 'A vidraçaria' },
  'torneiro-mecanico':      { noun: 'TORNEARIA',            prefix: 'A tornearia mecânica' },
  'funileiro':              { noun: 'FUNILARIA',            prefix: 'A funilaria' },

  // Serviços 2
  'motorista-app':          { noun: 'MOBILIDADE',           prefix: 'O motorista de app' },
  'garcom':                 { noun: 'ATENDIMENTO',          prefix: 'O atendimento' },
  'barbeiro':               { noun: 'BARBEARIA',            prefix: 'A barbearia' },
  'porteiro':               { noun: 'PORTARIA',             prefix: 'A portaria' },

  // Rural 2
  'apicultor':              { noun: 'APICULTURA',           prefix: 'A apicultura' },
  'produtor-rural':         { noun: 'PRODUÇÃO RURAL',       prefix: 'A produção rural' },
  'guarda-florestal':       { noun: 'CONSERVAÇÃO',          prefix: 'A conservação ambiental' },
};

const GENERIC = { noun: 'SUA PROFISSÃO', prefix: 'A sua profissão' };

function getCtaConfig(slug, variant) {
  const cfg = (variant === 'generic') ? GENERIC : (NOUNS[slug] || GENERIC);
  return {
    hookLine1: cfg.noun,
    hookLine2: 'MUDOU. E AGORA?',
    narrPrefix: `${cfg.prefix} mudou. E agora?`,
  };
}

// === Música de fundo ===
// Trilha por variante (v0/undefined = comportamento original):
//   prof    → A (pad ambient)   |   generic → B (cinematic bgm)
// Trilha por versão narrativa (A/B testing — v1-v5):
//   v1 Nostálgica    → C (acoustic guitar fingerpicking — CC0)
//   v2 Confidente    → D (lofi jazz warm — CC0)
//   v3 Provocação    → E (cinematic drum build — CC-BY Alastair_Pursloe)
//   v4 Intimista     → F (orchestral warm strings — CC-BY EvanBoyerman)
//   v5 Revelação     → B (bgm_v1 cinematic — já temos, mood match alto)
const MUSIC_DIR = '/home/nmaldaner/projetos/mkvideos/prj/inema/assets/music/cta';

const MUSIC_TRACKS = {
  A: '/home/nmaldaner/projetos/mkvideos/prj/inema/outputs/c0075-contadores_ia_automacao/audio/freesound_569920_Atmospheric_Ambient_Pad_128bpm_mp3.mp3',
  B: '/home/nmaldaner/projetos/mkvideos/remotion-ad/public/audio/bgm_v1.mp3',
  C: `${MUSIC_DIR}/freesound_523825_acoustic_guitar_nostalgic.mp3`,
  D: `${MUSIC_DIR}/freesound_629154_lofi_jazz_warm.mp3`,
  E: `${MUSIC_DIR}/freesound_156867_cinematic_drum_build.mp3`,
  F: `${MUSIC_DIR}/freesound_753968_warm_strings_build.mp3`,
};

// Trilha por versão narrativa — versão tem prioridade sobre variante quando definida
const VERSION_MUSIC = { '1': 'C', '2': 'D', '3': 'E', '4': 'F', '5': 'B' };

function getMusicForVariant(variant) {
  const fs = require('fs');
  const key = variant === 'prof' ? 'A' : 'B';
  const candidates = [MUSIC_TRACKS[key], MUSIC_TRACKS[key === 'A' ? 'B' : 'A']];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getMusicForVariantAndVersion(variant, version) {
  const fs = require('fs');
  const vStr = version ? String(version) : null;
  const key = (vStr && VERSION_MUSIC[vStr]) ? VERSION_MUSIC[vStr]
              : (variant === 'prof' ? 'A' : 'B');
  const fallbackKey = variant === 'prof' ? 'A' : 'B';
  const candidates = [MUSIC_TRACKS[key], MUSIC_TRACKS[fallbackKey]];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

module.exports = { NOUNS, GENERIC, getCtaConfig, getMusicForVariant, getMusicForVariantAndVersion, MUSIC_TRACKS, VERSION_MUSIC };
