import type { GenerationResult } from './types';

type BrandLike = {
  name: string;
  product: string;
  positioning: string;
  cta: string;
};

type BriefLike = {
  language: string;
  extra: string;
};

export function extractAudienceIntent(extra: string) {
  const contentMatch = extra.match(/CONTENT REQUEST:\s*([\s\S]*)$/i);
  const raw = (contentMatch?.[1] || extra || '').trim();
  const nested = raw.match(/Follow this request exactly:\s*([\s\S]*?)(?=\.\s*(?:Keep it aligned|Make the output|Do not invent)|$)/i);
  return (nested?.[1] || raw).trim();
}

export function looksLikeProductionInstruction(value: string) {
  const text = (value || '').trim();
  if (!text) return false;
  return /^(?:create|make|design|generate|produce|write|draft|build|prepare|develop)\b/i.test(text)
    || /\b(?:static ad|poster|carousel|social post|marketing asset)\b.*\bfor\b/i.test(text)
    || /follow (?:this|the|user'?s) request exactly/i.test(text)
    || /do not invent (?:facts|proof|prices|availability|endorsements|guarantees)/i.test(text);
}

function isMalay(language: string) {
  return /bahasa|malay|manglish|\bbm\b/i.test(language || '');
}

export function deriveAudienceHeadline(brandName: string, request: string, language = '') {
  const clean = (request || '').trim();
  const lower = clean.toLowerCase();
  const malay = isMalay(language);

  const quotedTitle = clean.match(/(?:titled?|headline)\s*[“\"]([^”\"]+)[”\"]/i)?.[1]?.trim();
  if (quotedTitle) return quotedTitle;

  if (/install|add to home screen|notification/.test(lower)) {
    return malay ? `Nak install ${brandName}? Senang je 📱` : `How to Install ${brandName} 📱`;
  }
  if (/female.*(?:driver|preferred)|(?:driver|preferred).*female/.test(lower)) {
    return malay ? 'Prefer female driver? Ini caranya.' : 'Prefer a female driver? Here’s how.';
  }
  if (/\bintro\b|introduc|what is|apa (?:itu|sebenarnya)|about\s+kampusride|about\s+the brand/.test(lower)) {
    return malay ? `${brandName} ni sebenarnya apa?` : `Meet ${brandName}`;
  }
  if (/how to|step[- ]by[- ]step|tutorial|guide|teach/.test(lower)) {
    return malay ? `Macam mana nak guna ${brandName}?` : `How to use ${brandName}`;
  }

  return brandName;
}

function kampusRideIntroBody() {
  return 'KampusRide susunkan cara student UIA cari dan offer transporter dalam satu flow: passenger post ride request, driver hantar offer, passenger compare dan pilih, kemudian coordination kekal dalam app. Komuniti yang sama, cara yang lebih tersusun.';
}

function kampusRideFemaleBody() {
  return 'Masa buat ride request, pilih female preferred. Bila female driver available, preference itu boleh diprioritikan. Ia preference, bukan guarantee kerana availability boleh berubah.';
}

function safeBody(brand: BrandLike, request: string) {
  const lower = request.toLowerCase();
  if (brand.name.toLowerCase().includes('kampusride')) {
    if (/female.*(?:driver|preferred)|(?:driver|preferred).*female/.test(lower)) return kampusRideFemaleBody();
    if (/\bintro\b|introduc|what is|about\s+kampusride/.test(lower)) return kampusRideIntroBody();
  }
  const product = (brand.product || '').trim();
  const positioning = (brand.positioning || '').trim();
  return [product, positioning].filter(Boolean).join(' ').trim() || request;
}

export function sanitizeGenerationResultForAudience(
  result: GenerationResult,
  brand: BrandLike,
  brief: BriefLike,
): GenerationResult {
  const request = extractAudienceIntent(brief.extra);
  return {
    ...result,
    variants: result.variants.map((variant) => {
      const badHook = looksLikeProductionInstruction(variant.hook);
      const hook = badHook ? deriveAudienceHeadline(brand.name, request, brief.language) : variant.hook;
      const badScript = looksLikeProductionInstruction(variant.script) || /follow this request exactly|do not invent facts/i.test(variant.script);
      const badCaption = looksLikeProductionInstruction(variant.caption) || /follow this request exactly|do not invent facts/i.test(variant.caption);
      const body = safeBody(brand, request);
      const cta = variant.cta || brand.cta || '';
      const rebuilt = `${hook}\n\n${body}${cta ? `\n\n${cta}` : ''}`;

      return {
        ...variant,
        hook,
        script: badScript ? rebuilt : variant.script,
        caption: badCaption ? rebuilt : variant.caption,
        creative_prompt: `${variant.creative_prompt} COPY SAFETY: production instructions and task labels are metadata only. Never render phrases such as “Create a poster”, “Static ad”, “Follow this request exactly”, format names, or internal instructions as audience-facing headline/body copy. Use only the audience-facing hook, supporting message and CTA.`,
      };
    }),
  };
}
