const SLOT_RE = /\{([a-zA-Z0-9_]+)\}/g;
const BUILTIN_SLOTS = new Set(['profissao_label', 'base_style']);

function extractFromString(s, out) {
  if (!s) return;
  let m;
  SLOT_RE.lastIndex = 0;
  while ((m = SLOT_RE.exec(s)) !== null) {
    if (!BUILTIN_SLOTS.has(m[1])) out.add(m[1]);
  }
}

function collectSlots(template) {
  const out = new Set();
  for (const b of (template.script || [])) {
    extractFromString(b.text, out);
    extractFromString(b.template, out);
    extractFromString(b.instruction, out);
  }
  for (const s of (template.visual?.shots || [])) {
    const p = s.prompt;
    if (p) {
      extractFromString(p.text, out);
      extractFromString(p.template, out);
      extractFromString(p.instruction, out);
    }
  }
  if (template.hook?.text) {
    const t = template.hook.text;
    extractFromString(t.text, out);
    extractFromString(t.template, out);
    extractFromString(t.instruction, out);
  }
  return out;
}

function checkSlotIntegrity(slots, profissoes) {
  const complete = [];
  const missing = [];
  for (const p of profissoes) {
    const miss = [...slots].filter((s) => !(p.props && s in p.props));
    if (miss.length === 0) complete.push(p);
    else missing.push({ slug: p.slug, missing_slots: miss });
  }
  return { complete, missing };
}

function estimateBudget(template, subset) {
  const rewriteBlocks = (template.script || []).filter((b) => b.type === 'rewrite').length;
  const hookIsRewrite = template.hook?.text?.type === 'rewrite' && template.hook.policy !== 'off' ? 1 : 0;
  const llmCalls = subset.length * (rewriteBlocks + hookIsRewrite);
  const images = subset.length * (template.visual?.shots?.length || 0);
  const tokensEst = llmCalls * (template.llm?.max_tokens || 200);
  return { videos: subset.length, llmCalls, tokensEst, images };
}

module.exports = { collectSlots, checkSlotIntegrity, estimateBudget };
