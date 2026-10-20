// Run from the repo root: npx tsx scripts/poster-render-check.mts — renders every template with placeholder images into the OS temp folder.
import { ImageResponse } from 'next/og';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { renderTemplate, SIZES } from '../lib/poster/templates.tsx';
import { posterFonts } from '../lib/poster/fonts.ts';

const svg = (w: number, h: number, fill: string, label: string) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${fill}"/><text x="50%" y="50%" font-size="60" text-anchor="middle" fill="#fff">${label}</text></svg>`).toString('base64');
const base = { brandName: 'SewaPro', headline: 'Cuti 4 hari Deepavali ni nak muat semua orang dalam satu kereta?', support: 'MPV 7 seater untuk balik kampung, hantar terus ke rumah.', cta: 'Bagi tarikh dan kawasan, kami terus quote.', contact: 'WhatsApp 014-570 5911', website: 'sewapro.my', colors: { primary: '#0C1130', secondary: '#83201A', light: '#F7F7F8' }, logo: svg(300, 120, '#0C1130', 'LOGO') };
const fonts = await posterFonts();
for (const [t, extra] of [['photo', { photo: svg(1000, 600, '#888', 'CAR PHOTO') }], ['bold', {}], ['scene', { background: svg(1080, 1350, '#3a5a40', 'AI SCENE') }]] as const) {
  for (const size of ['feed', 'story'] as const) {
    const { width, height } = SIZES[size];
    const img = new ImageResponse(renderTemplate(t as any, { ...base, ...extra } as any, size), { width, height, fonts });
    writeFileSync(`${tmpdir()}/poster-${t}-${size}.png`, Buffer.from(await img.arrayBuffer()));
  }
}
console.log('rendered to', tmpdir());
