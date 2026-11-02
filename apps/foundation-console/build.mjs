import { build } from 'esbuild';
import fs from 'node:fs';
const r = await build({ entryPoints: ['src/main.tsx'], bundle: true, format: 'iife', minify: true, write: false, jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment', target: 'es2020', charset: 'utf8', logLevel: 'warning' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', fs.readFileSync('template.html', 'utf8').replace('/*BUNDLE*/', () => js));
console.log('dist/index.html', Math.round(fs.statSync('dist/index.html').size / 1024), 'KB');
