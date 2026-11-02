import { build } from 'esbuild';
import fs from 'node:fs';
const r = await build({ entryPoints: ['src/main.tsx'], bundle: true, format: 'iife', minify: true, write: false, jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2020', charset: 'utf8', logLevel: 'warning' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.mkdirSync('dist', { recursive: true });
const page = fs.readFileSync('template.html', 'utf8').replace('/*BUNDLE*/', () => js);
fs.writeFileSync('dist/index.html', page);
// نسخة مستقلة لـ GitHub Pages بهيكل HTML كامل
fs.writeFileSync('dist/standalone.html', `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">${page}</body></html>`);
console.log('dist/index.html', Math.round(fs.statSync('dist/index.html').size / 1024), 'KB');
