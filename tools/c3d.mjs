#!/usr/bin/env node
// c3d sheet <shot.json> [n]          -> out/<name>_sheet.jpg  (n review stills in one small image)
// c3d render <a.json> [b.json ...] [--draft] [--out film.mp4] [--audio track.mp3]  -> one MP4 per shot, joined if several
import {bundle} from '@remotion/bundler';
import {renderStill, renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...rest] = process.argv.slice(2);
const opt = (k) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : null);
const flags = rest.filter((a) => a.startsWith('--')), args = rest.filter((a, i) => !a.startsWith('--') && !['--out', '--audio'].includes(rest[i - 1]));
const outFlag = opt('--out'), audio = opt('--audio');
const sys = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => fs.existsSync(p));
const browserExecutable = process.env.C3D_BROWSER || (os.platform() === 'linux' ? sys : undefined) || undefined;
const chromiumOptions = {gl: process.env.C3D_GL || (os.platform() === 'linux' ? 'swangle' : 'angle')};
const ff = (a) => { try { execFileSync('ffmpeg', a, {stdio: 'ignore'}); } catch { execFileSync('npx', ['remotion', 'ffmpeg', ...a], {cwd: root, stdio: 'ignore'}); } };
const out = path.join(root, 'out'); fs.mkdirSync(out, {recursive: true});
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const common = {browserExecutable, chromiumOptions, logLevel: process.env.C3D_LOG || 'error'};

const serveUrl = await bundle({entryPoint: path.join(root, 'src/index.jsx'), publicDir: path.join(root, 'public')});

if (cmd === 'sheet') {
  const spec = load(args[0]), n = Number(args[1] || 4), name = path.basename(args[0], '.json');
  const inputProps = {...spec, quality: 360};
  const comp = await selectComposition({serveUrl, id: 'Shot', inputProps, ...common});
  const files = [];
  for (let i = 0; i < n; i++) {
    const frame = Math.min(comp.durationInFrames - 1, Math.round(((i + 0.5) / n) * comp.durationInFrames));
    const f = path.join(out, `.${name}_${i}.png`);
    await renderStill({composition: comp, serveUrl, inputProps, frame, output: f, ...common});
    files.push(f);
  }
  const cols = comp.width >= comp.height ? 2 : Math.min(n, 4), sheet = path.join(out, `${name}_sheet.jpg`);
  ff(['-y', ...files.flatMap((f) => ['-i', f]), '-filter_complex', `xstack=inputs=${n}:layout=${files.map((_, i) => `${(i % cols) * comp.width}_${Math.floor(i / cols) * comp.height}`).join('|')}`, '-q:v', '4', sheet]);
  files.forEach((f) => fs.unlinkSync(f));
  console.log(sheet);
} else if (cmd === 'render') {
  const draft = flags.includes('--draft'), outs = [];
  for (const a of args) {
    const spec = load(a), inputProps = draft ? {...spec, quality: 480} : spec;
    const comp = await selectComposition({serveUrl, id: 'Shot', inputProps, ...common});
    const f = path.join(out, `${path.basename(a, '.json')}${draft ? '_draft' : ''}.mp4`);
    await renderMedia({composition: comp, serveUrl, inputProps, codec: 'h264', crf: draft ? 26 : 16, outputLocation: f,
      concurrency: process.env.C3D_CONCURRENCY ? Number(process.env.C3D_CONCURRENCY) : null, ...common});
    outs.push(f); console.log(f);
  }
  let film = outs[0];
  if (outs.length > 1) {
    const list = path.join(out, '.list.txt'); film = path.join(out, `film${draft ? '_draft' : ''}.mp4`);
    fs.writeFileSync(list, outs.map((f) => `file '${f}'`).join('\n'));
    ff(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', film]);
  }
  if (audio) { const m = film.replace(/\.mp4$/, '_audio.mp4'); ff(['-y', '-i', film, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-shortest', m]); film = m; }
  if (outFlag) { fs.copyFileSync(film, path.resolve(outFlag)); film = path.resolve(outFlag); }
  if (film !== outs[0]) console.log(film);
} else { console.log('usage: c3d sheet <shot.json> [n] | c3d render <shot.json...> [--draft] [--out film.mp4] [--audio track.mp3]'); }
process.exit(0);
