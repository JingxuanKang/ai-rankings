// Capture light-theme screenshots of the live site for the promo.
import { chromium } from 'playwright';
const URL = 'https://airankings.jingxuan.uk/';
const OUT = new globalThis.URL('../shots/', import.meta.url).pathname;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
  reducedMotion: 'reduce' });
await p.addInitScript(() => localStorage.setItem('sr-theme', 'light'));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const settle = () => p.waitForTimeout(1200);
const shotEl = async (sel, name) => {
  await p.locator(sel).scrollIntoViewIfNeeded(); await settle();
  await p.locator(sel).screenshot({ path: OUT + name + '.png' });
};
const shotView = async (y, name) => {
  await p.evaluate(y => scrollTo(0, y), y); await settle();
  await p.screenshot({ path: OUT + name + '.png' });
};
await shotView(0, 'hero');
// unpin the sticky control dock so it does not cover section captures
const unpin = () => p.addStyleTag({ content: '#dock{position:static!important}' });
const repin = () => p.evaluate(() => document.querySelectorAll('style').forEach(s => {
  if (s.textContent.includes('#dock{position:static')) s.remove(); }));
await unpin();
await shotEl('#podium-section', 'podium');
await shotView(560, 'board');
await shotEl('#map-section', 'map');
await shotEl('#vs-section', 'vs');
await shotEl('#canon-section', 'canon');
await shotEl('#paths-section', 'paths');
await shotEl('#board-section', 'board-sec');
await shotEl('#nations-section', 'nations');
await p.click('#seg-lens button[data-v="now"]'); await shotEl('#board-section', 'board-now-sec');
await p.click('#seg-lens button[data-v="alltime"]');
await p.click('#seg-scope button[data-v="industry"]'); await shotEl('#board-section', 'board-industry-sec');
await p.click('#seg-scope button[data-v="academia"]');
await repin();
await p.click('#seg-lens button[data-v="now"]'); await shotView(560, 'board-now');
await p.click('#seg-lens button[data-v="alltime"]');
await p.click('#seg-scope button[data-v="industry"]'); await shotView(560, 'board-industry');
await p.click('#seg-scope button[data-v="academia"]');
await shotView(700, 'podium-full');
await p.click('.podium-card.p1'); await p.waitForTimeout(1500);
await p.screenshot({ path: OUT + 'dossier.png' });
await b.close();
