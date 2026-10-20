/* eslint-disable @next/next/no-img-element */
import React, { type ReactElement } from 'react';

void React; // classic-JSX runtimes (scripts) need React in scope; Next uses the automatic runtime.

/**
 * Poster templates rendered by next/og (Satori). Every word on the poster comes from
 * PosterData, never from an image model, so headlines, phone numbers and prices are exact.
 * Satori rule: any element with more than one child needs display:flex.
 */

export type PosterTemplate = 'photo' | 'bold' | 'scene';
export type PosterSize = 'feed' | 'story';

export type PosterData = {
  brandName: string;
  headline: string;
  support: string;
  cta: string;
  contact: string;
  website: string;
  colors: { primary: string; secondary: string; light: string };
  logo?: string | null;      // data URL
  photo?: string | null;     // data URL (real product photo)
  background?: string | null; // data URL (AI scene, no text)
};

export const SIZES: Record<PosterSize, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};

function headlineSize(text: string, base: number) {
  const n = text.length;
  if (n <= 32) return base;
  if (n <= 55) return Math.round(base * 0.82);
  if (n <= 80) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

function Logo({ data, size = 120 }: { data: PosterData; size?: number }) {
  if (data.logo) {
    return <img src={data.logo} alt="" style={{ height: size, maxWidth: size * 3, objectFit: 'contain', borderRadius: 12 }} />;
  }
  return <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: size * 0.42, letterSpacing: -1 }}>{data.brandName}</div>;
}

function CtaBar({ data, height }: { data: PosterData; height: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height, padding: '0 64px', background: data.colors.secondary, color: '#ffffff' }}>
      <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: 46, lineHeight: 1.15 }}>{data.contact || data.cta}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontFamily: 'Inter', fontSize: 28, opacity: 0.92 }}>
        <span>{data.contact ? data.cta : ''}</span>
        <span>{data.website}</span>
      </div>
    </div>
  );
}

/** Navy headline block, real car photo, red contact bar. */
function PhotoTemplate(data: PosterData, size: PosterSize): ReactElement {
  const { width, height } = SIZES[size];
  const story = size === 'story';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: data.colors.light, fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: story ? '96px 64px 48px' : '64px 64px 36px', background: data.colors.primary, color: '#ffffff' }}>
        <div style={{ display: 'flex', marginBottom: 36, background: '#ffffff', alignSelf: 'flex-start', padding: '10px 18px', borderRadius: 16 }}><Logo data={data} size={story ? 96 : 80} /></div>
        <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: headlineSize(data.headline, story ? 92 : 84), lineHeight: 1.08, letterSpacing: -1.5 }}>{data.headline}</div>
        {data.support && <div style={{ display: 'flex', marginTop: 24, fontSize: story ? 38 : 34, lineHeight: 1.35, opacity: 0.9 }}>{data.support}</div>}
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', padding: '24px 40px' }}>
        {data.photo
          ? <img src={data.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: 64, color: data.colors.primary }}>{data.brandName}</div>}
      </div>
      <CtaBar data={data} height={story ? 230 : 200} />
    </div>
  );
}

/** Type-only poster for posts with no matching photo. */
function BoldTemplate(data: PosterData, size: PosterSize): ReactElement {
  const { width, height } = SIZES[size];
  const story = size === 'story';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: data.colors.primary, color: '#ffffff', fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', padding: story ? '96px 64px 0' : '64px 64px 0' }}>
        <div style={{ display: 'flex', background: '#ffffff', padding: '10px 18px', borderRadius: 16 }}><Logo data={data} size={story ? 96 : 80} /></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', padding: '0 64px' }}>
        <div style={{ display: 'flex', width: 120, height: 12, background: data.colors.secondary, borderRadius: 6, marginBottom: 40 }} />
        <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: headlineSize(data.headline, story ? 112 : 100), lineHeight: 1.05, letterSpacing: -2 }}>{data.headline}</div>
        {data.support && <div style={{ display: 'flex', marginTop: 40, fontSize: story ? 42 : 38, lineHeight: 1.35, opacity: 0.88 }}>{data.support}</div>}
      </div>
      <CtaBar data={data} height={story ? 230 : 200} />
    </div>
  );
}

/** AI background scene (no text in it) under a dark gradient, with exact text on top. */
function SceneTemplate(data: PosterData, size: PosterSize): ReactElement {
  const { width, height } = SIZES[size];
  const story = size === 'story';
  return (
    <div style={{ display: 'flex', position: 'relative', width, height, background: data.colors.primary, fontFamily: 'Inter' }}>
      {data.background && <img src={data.background} alt="" style={{ position: 'absolute', top: 0, left: 0, width, height, objectFit: 'cover' }} />}
      <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width, height, backgroundImage: 'linear-gradient(180deg, rgba(8,12,36,0.88) 0%, rgba(8,12,36,0.55) 38%, rgba(8,12,36,0.05) 62%, rgba(8,12,36,0.0) 100%)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', top: 0, left: 0, width, height }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: story ? '96px 64px 0' : '64px 64px 0', color: '#ffffff' }}>
          <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#ffffff', padding: '10px 18px', borderRadius: 16, marginBottom: 36 }}><Logo data={data} size={story ? 96 : 80} /></div>
          <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 800, fontSize: headlineSize(data.headline, story ? 96 : 86), lineHeight: 1.06, letterSpacing: -1.5 }}>{data.headline}</div>
          {data.support && <div style={{ display: 'flex', marginTop: 24, fontSize: story ? 38 : 34, lineHeight: 1.35 }}>{data.support}</div>}
        </div>
        <div style={{ display: 'flex', flex: 1 }} />
        <CtaBar data={data} height={story ? 230 : 200} />
      </div>
    </div>
  );
}

export function renderTemplate(template: PosterTemplate, data: PosterData, size: PosterSize): ReactElement {
  if (template === 'scene') return SceneTemplate(data, size);
  if (template === 'photo' && data.photo) return PhotoTemplate(data, size);
  return BoldTemplate(data, size);
}
