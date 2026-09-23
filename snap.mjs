// Dev helper: screenshot every figure (and optional selector) in light or dark mode.
// node snap.mjs <outdir> [light|dark] [selector]
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [out, theme = 'light', sel = 'figure.fig'] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const p = await b.newPage();
await p.setViewport({ width: 1300, height: 900, deviceScaleFactor: 1 });
await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
await p.goto(pathToFileURL(path.resolve('index.html')).href, { waitUntil: 'networkidle0' });
const els = await p.$$(sel);
for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: `${out}/${theme}-${String(i).padStart(2, '0')}.png` });
console.log(els.length, 'shots');
await b.close();
