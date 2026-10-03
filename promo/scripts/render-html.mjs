// Render html/index.html frame-by-frame to out/ai-rankings-promo-html.mp4 (same pipeline as cospace/promo).
// Usage: node scripts/render-html.mjs [--stills 3,12,...] [--fps 30] [--workers 6]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FPS = +opt('--fps', 30);
const WORKERS = +opt('--workers', 6);
const stills = opt('--stills');
const NAME = "ai-rankings-promo";
const out = path.join(ROOT, 'out');
const url = 'file://' + path.join(ROOT, 'html', 'index.html') + '?render';

async function page(browser) {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(url);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
  await p.waitForTimeout(300);
  return p;
}

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
if (stills) {
  const p = await page(browser);
  for (const t of stills.split(',').map(Number)) {
    await p.evaluate(t => window.__render(t), t);
    await p.screenshot({ path: path.join(out, `html-still-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}
const p0 = await page(browser);
const total = Math.round(await p0.evaluate(() => window.__duration) * FPS);
const dir = path.join(out, 'frames-html');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const pages = [p0, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, () => page(browser))))];
let next = 0, done = 0;
await Promise.all(pages.map(async p => {
  while (next < total) {
    const i = next++;
    await p.evaluate(t => window.__render(t), i / FPS);
    await p.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 94 });
    if (++done % 300 === 0) console.log(`${done}/${total}`);
  }
}));
await browser.close();
const audio = path.join(out, 'music.wav');
const ff = ['-y', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg')];
if (fs.existsSync(audio)) ff.push('-i', audio, '-c:a', 'aac', '-b:a', '192k', '-shortest');
ff.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, NAME + '.mp4'));
await new Promise((res, rej) => spawn('ffmpeg', ff, { stdio: ['ignore', 'ignore', 'inherit'] })
  .on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
fs.rmSync(dir, { recursive: true, force: true });
console.log(`wrote out/${NAME}.mp4`);
