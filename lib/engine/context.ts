import type { BrandProfile, ProfileChannel, ProfileExemplar, ProfileMode, ProfilePhase } from './profile';

export type KnowledgeItem = { kind: string; title: string; content: string };

export function malaysiaToday() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}

export function addDaysIso(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const value = new Date(Date.UTC(y, m - 1, d));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isThreads(platform: string) {
  return /threads/i.test(platform);
}

export function isMalay(language: string) {
  return /bahasa|melayu|malay|manglish|\bbm\b/i.test(language || '');
}

export function currentPhase(profile: BrandProfile, override?: string | null): ProfilePhase {
  const key = override || profile.phase.current;
  return profile.phase.options.find((p) => p.key === key)
    ?? profile.phase.options[0]
    ?? { key, label: key, guidance: '', ctas: [], replace: [], qa_notes: [] };
}

export function calendarFor(profile: BrandProfile, date: string) {
  return profile.calendar.filter((w) => date >= w.start && date <= w.end);
}

export function upcomingMoments(profile: BrandProfile, from: string, days: number) {
  const to = addDaysIso(from, days);
  return profile.calendar.filter((w) => w.moment && w.end >= from && w.start <= to);
}

export function channelFor(profile: BrandProfile, platform: string): ProfileChannel | null {
  const p = platform.toLowerCase();
  return profile.channels.find((c) => c.platform.toLowerCase() === p)
    ?? profile.channels.find((c) => p.includes(c.platform.toLowerCase()) || c.platform.toLowerCase().includes(p))
    ?? null;
}

function matches(text: string, needle: string) {
  try {
    return new RegExp(needle, 'i').test(text);
  } catch {
    return text.toLowerCase().includes(needle.toLowerCase());
  }
}

export function modeFor(profile: BrandProfile, text: string): ProfileMode | null {
  return profile.modes.find((m) => m.match.some((n) => matches(text, n))) ?? null;
}

export function talkingPointsFor(profile: BrandProfile, text: string, limit = 3) {
  const lower = text.toLowerCase();
  return profile.talking_points.filter((t) => t.match.some((k) => lower.includes(k.toLowerCase()))).slice(0, limit).map((t) => t.text);
}

/** Deterministic but different every run: rotates by a seed so repeated plans don't start identically. */
function seededShuffle<T>(items: T[], seed: number) {
  const out = [...items];
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function exemplarsFor(profile: BrandProfile, phaseKey: string, opts: { avoidHooks?: string[]; seed?: number; limit?: number } = {}): ProfileExemplar[] {
  const avoid = new Set((opts.avoidHooks ?? []).map((h) => h.trim().toLowerCase()));
  const valid = profile.exemplars.filter((e) => e.phases.length === 0 || e.phases.includes(phaseKey));
  const fresh = valid.filter((e) => !avoid.has(e.hook.trim().toLowerCase()));
  const pool = fresh.length >= Math.min(5, valid.length) ? fresh : valid;
  return seededShuffle(pool, opts.seed ?? Date.now() % 100000).slice(0, opts.limit ?? pool.length);
}

/** Applies the current phase's phrase replacements (e.g. live CTAs before launch). */
export function applyPhaseRules(text: string, phase: ProfilePhase) {
  return phase.replace.reduce((value, rule) => {
    try {
      return value.replace(new RegExp(rule.pattern, 'gi'), rule.with);
    } catch {
      return value.split(rule.pattern).join(rule.with);
    }
  }, text || '');
}

export function knowledgeBlock(items: KnowledgeItem[], limit = 40) {
  if (!items.length) return 'No knowledge items saved yet.';
  return items.slice(0, limit).map((item, i) => `${i + 1}. [${item.kind}] ${item.title}: ${item.content}`).join('\n');
}

/** The shared brief every AI call gets. One place, so plan/generate/produce never disagree. */
export function brandContext(profile: BrandProfile, brandName: string, opts: {
  date: string;
  phase: ProfilePhase;
  knowledge: KnowledgeItem[];
  platforms?: string[];
  extraGuidance?: string;
}) {
  const windows = calendarFor(profile, opts.date);
  const moments = upcomingMoments(profile, opts.date, 35);
  const channels = (opts.platforms?.length
    ? opts.platforms.map((p) => channelFor(profile, p) ?? { platform: p, role: '', tone: '', formats: [], cadence: '', link: '', ctas: [], manual: false })
    : profile.channels);
  const lines = [
    `BRAND: ${brandName}`,
    profile.summary,
    '',
    `LANGUAGE: ${profile.language.default}. ${profile.language.guidance}`,
    '',
    `CURRENT PHASE: ${opts.phase.label}. ${opts.phase.guidance}`,
    opts.phase.ctas.length ? `CTAs suited to this phase: ${opts.phase.ctas.join(' | ')}` : '',
    '',
    `TODAY (Malaysia): ${opts.date}`,
    windows.length ? `Now: ${windows.map((w) => `${w.label}: ${w.guidance}`).join(' ')}` : '',
    moments.length ? `Coming up: ${moments.map((w) => `${w.label} (${w.start} to ${w.end}): ${w.guidance}`).join(' ')}` : '',
    '',
    profile.audiences.length ? `AUDIENCES:\n${profile.audiences.map((a) => `- ${a.name}: ${a.description}`).join('\n')}` : '',
    profile.pillars.length ? `CONTENT PILLARS (weight = share of output):\n${profile.pillars.map((p) => `- ${p.name} (${p.weight}): ${p.goal}`).join('\n')}` : '',
    channels.length ? `CHANNELS:\n${channels.map((c) => `- ${c.platform}: ${c.role}. Tone: ${c.tone}.${c.formats.length ? ` Formats: ${c.formats.join(', ')}.` : ''}${c.cadence ? ` Cadence: ${c.cadence}.` : ''}${c.link ? ` Link: ${c.link}.` : ''}${c.ctas.length ? ` CTAs: ${c.ctas.join(' | ')}.` : ''}`).join('\n')}` : '',
    '',
    `VERIFIED FACTS (the only facts you may state):\n${profile.talking_points.map((t) => `- ${t.text}`).join('\n')}\n${knowledgeBlock(opts.knowledge)}`,
    '',
    profile.claims.never.length ? `NEVER CLAIM OR SAY:\n${profile.claims.never.map((c) => `- ${c}`).join('\n')}` : '',
    profile.claims.always.length ? `ALWAYS:\n${profile.claims.always.map((c) => `- ${c}`).join('\n')}` : '',
    profile.qa_notes.length ? `QUALITY BAR:\n${profile.qa_notes.map((c) => `- ${c}`).join('\n')}` : '',
    opts.extraGuidance || '',
  ];
  return lines.filter((l) => l !== '').join('\n');
}

export function exemplarBlock(exemplars: ProfileExemplar[]) {
  if (!exemplars.length) return '';
  return `STYLE REFERENCES (examples of the right voice and specificity; write NEW ideas, never copy these hooks):\n${exemplars.map((e) => `- [${e.pillar}] "${e.hook}": ${e.concept}`).join('\n')}`;
}
