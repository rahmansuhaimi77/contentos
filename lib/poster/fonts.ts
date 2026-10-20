import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Poster fonts, bundled in lib/poster/fonts (OFL licensed, from @fontsource). Satori reads
 * WOFF/TTF but not WOFF2. Bundling keeps rendering offline and identical every time.
 * next.config.ts traces this folder into the /api/poster function.
 */
type Font = { name: string; data: Buffer; weight: 400 | 600 | 800; style: 'normal' };

const FILES: Array<[string, Font['weight'], string]> = [
  ['Poppins', 800, 'poppins-latin-800-normal.woff'],
  ['Inter', 400, 'inter-latin-400-normal.woff'],
  ['Inter', 600, 'inter-latin-600-normal.woff'],
];

let cache: Promise<Font[]> | null = null;

export function posterFonts() {
  if (!cache) {
    const dir = path.join(process.cwd(), 'lib', 'poster', 'fonts');
    cache = Promise.all(FILES.map(async ([name, weight, file]) => ({ name, weight, style: 'normal' as const, data: await readFile(path.join(dir, file)) })));
  }
  return cache;
}
