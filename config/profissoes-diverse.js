/**
 * Diversidade brasileira nas 90 profissões — overlay sobre config/profissoes-30.js.
 *
 * NÃO modifica o config original. Substitui apenas:
 *   - character (descrição visual da pessoa: pele, cabelo, traços)
 *   - pronoun (he/she conforme gênero)
 *   - hair_style (estilo de cabelo coerente com região/gênero/etnia)
 *
 * Distribuição (proporcional à demografia BR):
 *   - sudeste: 38 (mistura ampla — pardo/branco/preto/asiático)
 *   - nordeste: 24 (preta/parda, cabelo crespo/cacheado)
 *   - sul: 13 (branca, olhos claros, descendência alemã/italiana)
 *   - norte: 8 (caboclo/indígena, pele oliva)
 *   - centro-oeste: 7 (sertanejo bronzeado)
 *
 * Gênero: ~32 homens / 58 mulheres (afinidade por profissão).
 */

// Personagens base por região × gênero × variante étnica.
// Cada string é um "character" pronto pra ser injetado nos prompts.
const CHARACTERS = {
  // ========= SUDESTE =========
  sudeste: {
    F: {
      branca:    'Brazilian woman from São Paulo with fair skin, light brown wavy hair, hazel eyes, refined urban presence',
      parda:     'Brazilian woman from São Paulo with light brown skin, dark curly hair, warm brown eyes, confident metropolitan look',
      preta:     'Brazilian Black woman from Rio de Janeiro with rich dark brown skin, natural afro hair, deep expressive eyes, strong elegant presence',
      asiatica:  'Brazilian woman of Japanese descent from São Paulo with light skin, straight black hair, dark almond eyes, composed precise presence',
      sirio:     'Brazilian woman of Lebanese descent from São Paulo with olive skin, dark wavy hair, large dark eyes, warm Mediterranean features',
    },
    M: {
      branco:    'Brazilian man from São Paulo with fair skin, short brown hair, hazel eyes, clean professional appearance',
      pardo:     'Brazilian man from Rio de Janeiro with light brown skin, short dark curly hair, warm brown eyes, relaxed urban demeanor',
      preto:     'Brazilian Black man from São Paulo with rich dark brown skin, short curly hair, expressive deep eyes, confident strong presence',
    },
  },
  // ========= NORDESTE =========
  nordeste: {
    F: {
      preta:     'Brazilian Black woman from Bahia with deep dark brown skin, voluminous natural curly afro hair, expressive warm eyes, radiant smile, strong baiana presence',
      parda:     'Brazilian woman from Pernambuco with warm caramel skin, long curly chestnut hair, bright dark eyes, sun-warmed nordestina features',
      morena:    'Brazilian woman from Ceará with golden tan skin, dark wavy hair, expressive deep eyes, weathered nordestina warmth',
    },
    M: {
      preto:     'Brazilian Black man from Bahia with deep dark brown skin, short tightly curled hair, expressive eyes, weathered hands, strong nordestino dignity',
      pardo:     'Brazilian man from Pernambuco with warm caramel skin, short dark hair, bright dark eyes, sun-tanned nordestino working presence',
    },
  },
  // ========= SUL =========
  sul: {
    F: {
      alema:     'Brazilian woman from Rio Grande do Sul of German descent with very fair skin, straight blonde hair, blue eyes, composed sulista presence',
      italiana:  'Brazilian woman from Santa Catarina of Italian descent with fair skin, dark wavy chestnut hair, hazel eyes, gentle sulista refinement',
      polonesa:  'Brazilian woman from Paraná of Polish descent with fair pale skin, light brown straight hair, light blue-green eyes, quiet sulista demeanor',
    },
    M: {
      alemao:    'Brazilian man from Rio Grande do Sul of German descent with fair skin, light brown hair, blue eyes, blonde-brown beard, gaúcho practical look',
      italiano:  'Brazilian man from Santa Catarina of Italian descent with fair skin, dark wavy hair, hazel eyes, full beard, sulista warm strength',
    },
  },
  // ========= NORTE =========
  norte: {
    F: {
      cabocla:   'Brazilian woman from Amazonas with caboclo features (mixed Indigenous and European heritage), olive bronzed skin, long straight black hair, dark almond eyes, serene river-people presence',
      indigena:  'Brazilian woman from Pará with strong Indigenous features, golden bronze skin, straight jet-black hair, deep dark eyes, calm Amazonian dignity',
    },
    M: {
      caboclo:   'Brazilian man from Amazonas with caboclo features (mixed Indigenous and European heritage), olive bronzed skin, straight black hair, dark almond eyes, ribeirinho weathered strength',
      indigena:  'Brazilian man from Pará with strong Indigenous features, golden bronze skin, jet-black hair, deep dark eyes, calm Amazonian presence',
    },
  },
  // ========= CENTRO-OESTE =========
  'centro-oeste': {
    F: {
      sertaneja: 'Brazilian woman from Goiás with sun-bronzed skin, long wavy dark brown hair, warm brown eyes, sertaneja outdoor warmth',
      morena:    'Brazilian woman from Mato Grosso with warm tan skin, dark wavy hair, bright dark eyes, cerrado-warmed natural beauty',
    },
    M: {
      sertanejo: 'Brazilian man from Goiás with deeply sun-bronzed skin, short dark hair, weathered brown eyes, brown beard, sertanejo rural strength',
      pardo:     'Brazilian man from Mato Grosso with warm tan skin, short dark hair, bright eyes, cerrado outdoor look',
    },
  },
};

// Estilos de cabelo coerentes (override do hair_style do config original quando faz sentido).
const HAIR = {
  F: {
    'natural afro hair': 'natural afro hair tied back practically',
    'curly chestnut hair': 'curly chestnut hair in a practical low ponytail',
    'wavy hair': 'wavy hair pulled back',
    'straight black hair': 'straight black hair in a clean ponytail',
    'blonde hair': 'straight blonde hair tied in a low knot',
    'wavy dark brown hair': 'wavy dark brown hair loosely tied',
  },
  M: {
    'short curly hair': 'short well-groomed curly hair',
    'short dark hair': 'short clean-cut dark hair',
    'short brown hair': 'short brown hair, slightly tousled',
    'jet-black hair': 'short straight jet-black hair',
    'light brown hair': 'short light brown hair, slight beard',
  },
};

// Mapeamento slug → { region, gender, variant }.
const ASSIGNMENTS = {
  // Saúde básica (10)
  'fisioterapeuta':         { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'crianca-medica':         { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'enfermeira':             { region: 'nordeste',     gender: 'F', variant: 'preta' },
  'psicologa':              { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'dentista':               { region: 'sul',          gender: 'F', variant: 'alema' },
  'farmaceutica':           { region: 'nordeste',     gender: 'F', variant: 'parda' },
  'nutricionista':          { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'fonoaudiologa':          { region: 'sudeste',      gender: 'F', variant: 'asiatica' },
  'terapeuta-ocupacional':  { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'biomedica':              { region: 'sul',          gender: 'F', variant: 'italiana' },

  // Educação básica (5)
  'professora-fundamental': { region: 'nordeste',     gender: 'F', variant: 'preta' },
  'professora-medio':       { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'pedagoga':               { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'educacao-infantil':      { region: 'nordeste',     gender: 'F', variant: 'morena' },
  'psicopedagoga':          { region: 'sul',          gender: 'F', variant: 'polonesa' },

  // Escritório (5)
  'contador':               { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'advogada':               { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'secretaria':             { region: 'nordeste',     gender: 'F', variant: 'parda' },
  'administrador':          { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'analista-rh':            { region: 'sudeste',      gender: 'F', variant: 'sirio' },

  // Ofícios 1 (5)
  'eletricista':            { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'encanador':              { region: 'nordeste',     gender: 'M', variant: 'pardo' },
  'mecanico':               { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'marceneiro':             { region: 'sul',          gender: 'M', variant: 'italiano' },
  'costureira':             { region: 'nordeste',     gender: 'F', variant: 'parda' },

  // Serviço/criativo (5)
  'cabeleireira':           { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'chef':                   { region: 'sudeste',      gender: 'M', variant: 'branco' },
  'fotografo':              { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'jornalista':             { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'arquiteta':              { region: 'sudeste',      gender: 'F', variant: 'parda' },

  // Saúde especializada (6)
  'cardiologista':          { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'pediatra':               { region: 'nordeste',     gender: 'F', variant: 'preta' },
  'ginecologista':          { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'veterinario':            { region: 'centro-oeste', gender: 'M', variant: 'sertanejo' },
  'massoterapeuta':         { region: 'nordeste',     gender: 'F', variant: 'parda' },
  'parteira':               { region: 'norte',        gender: 'F', variant: 'cabocla' },

  // Educação superior (5)
  'professor-universitario':{ region: 'sul',          gender: 'M', variant: 'alemao' },
  'professor-matematica':   { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'educador-fisico':        { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'bibliotecaria':          { region: 'sul',          gender: 'F', variant: 'italiana' },
  'coordenador-escolar':    { region: 'nordeste',     gender: 'F', variant: 'parda' },

  // Direito/Finanças (4)
  'juiza':                  { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'delegada':               { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'auditor-fiscal':         { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'consultor-financeiro':   { region: 'sudeste',      gender: 'F', variant: 'asiatica' },

  // Ofícios 2 (5)
  'soldador':               { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'pintor':                 { region: 'nordeste',     gender: 'M', variant: 'pardo' },
  'pedreiro':               { region: 'nordeste',     gender: 'M', variant: 'preto' },
  'sapateiro':              { region: 'nordeste',     gender: 'M', variant: 'preto' },
  'relojoeiro':             { region: 'sul',          gender: 'M', variant: 'italiano' },

  // Transporte (3)
  'caminhoneiro':           { region: 'centro-oeste', gender: 'M', variant: 'sertanejo' },
  'piloto':                 { region: 'sudeste',      gender: 'M', variant: 'branco' },
  'controlador-aereo':      { region: 'sudeste',      gender: 'M', variant: 'pardo' },

  // Beleza/criativo 2 (4)
  'maquiadora':             { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'florista':               { region: 'sul',          gender: 'F', variant: 'alema' },
  'confeiteiro':            { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'dj-produtor':            { region: 'sudeste',      gender: 'M', variant: 'preto' },

  // Rural (3)
  'agronomo':               { region: 'centro-oeste', gender: 'M', variant: 'sertanejo' },
  'biologo-ambiental':      { region: 'norte',        gender: 'F', variant: 'cabocla' },
  'pescador':               { region: 'norte',        gender: 'M', variant: 'caboclo' },

  // Saúde especializada 2 (5)
  'ortopedista':            { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'oftalmologista':         { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'psiquiatra':             { region: 'sudeste',      gender: 'F', variant: 'sirio' },
  'dermatologista':         { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'personal-trainer':       { region: 'sudeste',      gender: 'M', variant: 'preto' },

  // Tech/Dados (5)
  'programador':            { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'analista-sistemas':      { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'designer-ux':            { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'gerente-projeto':        { region: 'sudeste',      gender: 'F', variant: 'branca' },
  'especialista-cybersec':  { region: 'sudeste',      gender: 'M', variant: 'pardo' },

  // Finanças 2 (4)
  'gerente-banco':          { region: 'sudeste',      gender: 'M', variant: 'branco' },
  'corretor-imoveis':       { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'vendedor':               { region: 'sudeste',      gender: 'F', variant: 'parda' },
  'empresario':             { region: 'sudeste',      gender: 'M', variant: 'branco' },

  // Artes (5)
  'musico':                 { region: 'nordeste',     gender: 'M', variant: 'preto' },
  'ator':                   { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'professor-danca':        { region: 'sudeste',      gender: 'F', variant: 'preta' },
  'escritor':               { region: 'sul',          gender: 'M', variant: 'italiano' },
  'animador':               { region: 'sudeste',      gender: 'F', variant: 'asiatica' },

  // Ofícios 3 (4)
  'serralheiro':            { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'vidraceiro':             { region: 'nordeste',     gender: 'M', variant: 'pardo' },
  'torneiro-mecanico':      { region: 'sul',          gender: 'M', variant: 'alemao' },
  'funileiro':              { region: 'nordeste',     gender: 'M', variant: 'pardo' },

  // Serviços 2 (4)
  'motorista-app':          { region: 'sudeste',      gender: 'M', variant: 'pardo' },
  'garcom':                 { region: 'sudeste',      gender: 'M', variant: 'preto' },
  'barbeiro':               { region: 'nordeste',     gender: 'M', variant: 'pardo' },
  'porteiro':               { region: 'nordeste',     gender: 'M', variant: 'preto' },

  // Rural 2 (3)
  'apicultor':              { region: 'norte',        gender: 'M', variant: 'caboclo' },
  'produtor-rural':         { region: 'centro-oeste', gender: 'M', variant: 'sertanejo' },
  'guarda-florestal':       { region: 'norte',        gender: 'M', variant: 'caboclo' },
};

// Hair style overrides por (region, gender, variant) — fallback ao do config original.
const HAIR_OVERRIDES = {
  'preta':     { F: 'natural afro hair tied back practically' },
  'parda':     { F: 'curly chestnut hair in a practical low ponytail' },
  'branca':    { F: 'wavy light brown hair pulled back' },
  'asiatica':  { F: 'sleek straight black hair in a clean ponytail' },
  'sirio':     { F: 'long wavy dark hair loosely tied' },
  'morena':    { F: 'long wavy dark hair' },
  'alema':     { F: 'straight blonde hair tied in a low knot' },
  'italiana':  { F: 'wavy chestnut hair pulled back' },
  'polonesa':  { F: 'fine straight light brown hair' },
  'cabocla':   { F: 'long straight black hair tied back' },
  'indigena':  { F: 'long jet-black straight hair' },
  'sertaneja': { F: 'long wavy dark brown hair' },
  // M
  'pardo':     { M: 'short well-groomed dark curly hair' },
  'branco':    { M: 'short brown hair, clean cut' },
  'preto':     { M: 'short well-groomed curly hair' },
  'alemao':    { M: 'short light brown hair with short blonde-brown beard' },
  'italiano':  { M: 'short dark wavy hair with full beard' },
  'caboclo':   { M: 'short straight black hair' },
  'sertanejo': { M: 'short dark hair with brown beard, sun-weathered' },
};

function getDiverseProfile(originalProfile) {
  const slug = originalProfile.slug;
  const a = ASSIGNMENTS[slug];
  if (!a) return originalProfile; // fallback: usa o original

  const regionData = CHARACTERS[a.region];
  if (!regionData || !regionData[a.gender] || !regionData[a.gender][a.variant]) {
    console.warn(`[diverse] character não encontrado: ${slug} ${a.region}/${a.gender}/${a.variant}`);
    return originalProfile;
  }

  const character = regionData[a.gender][a.variant];
  const pronoun = a.gender === 'F' ? 'she' : 'he';
  const hair = (HAIR_OVERRIDES[a.variant] && HAIR_OVERRIDES[a.variant][a.gender]) || originalProfile.hair_style;

  return {
    ...originalProfile,
    character,
    pronoun,
    hair_style: hair,
    _diversity: { region: a.region, gender: a.gender, variant: a.variant },
  };
}

function getAssignment(slug) {
  return ASSIGNMENTS[slug] || null;
}

function statsByRegion() {
  const stats = { sudeste: 0, nordeste: 0, sul: 0, norte: 0, 'centro-oeste': 0 };
  const genderStats = { M: 0, F: 0 };
  for (const slug of Object.keys(ASSIGNMENTS)) {
    stats[ASSIGNMENTS[slug].region] += 1;
    genderStats[ASSIGNMENTS[slug].gender] += 1;
  }
  return { regions: stats, gender: genderStats, total: Object.keys(ASSIGNMENTS).length };
}

module.exports = { getDiverseProfile, getAssignment, ASSIGNMENTS, CHARACTERS, statsByRegion };
