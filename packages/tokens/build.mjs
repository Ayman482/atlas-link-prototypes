// يولّد tokens.css للويب و tokens.dart لتطبيقي Flutter من tokens.json، ويطبع تقرير تباين WCAG
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const T = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url)));
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const vars = (o) => Object.entries(o).map(([k, v]) => `  --${kebab(k)}: ${v};`).join('\n');
const mo = T.motion;
const css = `/* مولَّد آلياً من packages/tokens/tokens.json — لا تعدّله يدوياً */
:root {
${vars(T.color.light)}
${Object.entries(T.radius).map(([k, v]) => `  --radius-${k}: ${v}px;`).join('\n')}
${Object.entries(T.space).map(([k, v]) => `  --space-${k}: ${v}px;`).join('\n')}
${Object.entries(mo.duration).map(([k, v]) => `  --dur-${k}: ${v}ms;`).join('\n')}
${Object.entries(mo.easing).map(([k, v]) => `  --ease-${k}: cubic-bezier(${v.join(', ')});`).join('\n')}
  --touch-min: ${T.touch.minTarget}px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
${vars(T.color.dark)}
  color-scheme: dark;
} }
:root[data-theme="dark"] {
${vars(T.color.dark)}
  color-scheme: dark;
}
`;
const out = process.argv[2] ?? '.';
writeFileSync(`${out}/tokens.css`, css);
const hex = (h) => '0xFF' + h.slice(1).toUpperCase();
const dartMap = (name, o) => `  static const ${name} = _Palette(\n${Object.entries(o).map(([k, v]) => `    ${k}: Color(${hex(v)}),`).join('\n')}\n  );`;
const keys = Object.keys(T.color.light);
const dart = `// مولَّد آلياً من packages/tokens/tokens.json — لا تعدّله يدوياً
import 'package:flutter/material.dart';

class _Palette {
${keys.map((k) => `  final Color ${k};`).join('\n')}
  const _Palette({${keys.map((k) => `required this.${k}`).join(', ')}});
}

class AtlasTokens {
${dartMap('light', T.color.light)}
${dartMap('dark', T.color.dark)}
${Object.entries(T.radius).map(([k, v]) => `  static const double radius${k[0].toUpperCase() + k.slice(1)} = ${v};`).join('\n')}
  static const double touchMin = ${T.touch.minTarget};
${Object.entries(mo.duration).map(([k, v]) => `  static const Duration dur${k[0].toUpperCase() + k.slice(1)} = Duration(milliseconds: ${v});`).join('\n')}
${Object.entries(mo.easing).map(([k, v]) => `  static const Curve ease${k[0].toUpperCase() + k.slice(1)} = Cubic(${v.join(', ')});`).join('\n')}
  static const Duration stagger = Duration(milliseconds: ${mo.stagger});
  static const String fontDisplay = '${T.type.display}';
  static const String fontBody = '${T.type.body}';
}
`;
for (const p of (process.env.DART_OUT ?? '').split(',').filter(Boolean)) { mkdirSync(p, { recursive: true }); writeFileSync(`${p}/tokens.dart`, dart); }
// تقرير التباين
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const pairs = [['fg', 'bg'], ['fg', 'surface'], ['muted', 'surface'], ['muted', 'bg'], ['faint', 'surface'], ['primary', 'surface'], ['primary', 'bg'], ['onPrimary', 'primary'], ['onNavy', 'navy'], ['goldText', 'surface'], ['goldText', 'goldSoft'], ['success', 'successSoft'], ['warning', 'warningSoft'], ['critical', 'criticalSoft'], ['info', 'infoSoft'], ['primaryText', 'primarySoft'], ['success', 'surface'], ['warning', 'surface'], ['critical', 'surface'], ['info', 'surface']];
const rows = [];
for (const mode of ['light', 'dark']) for (const [f, b] of pairs) { const r = ratio(T.color[mode][f], T.color[mode][b]); rows.push({ mode, pair: `${f} / ${b}`, ratio: r.toFixed(2), aaText: r >= 4.5, aaLarge: r >= 3 }); }
writeFileSync(`${out}/contrast-report.json`, JSON.stringify(rows, null, 2));
const fails = rows.filter((r) => !r.aaText && !r.pair.startsWith('faint'));
console.log(rows.map((r) => `${r.mode.padEnd(5)} ${r.pair.padEnd(26)} ${r.ratio}${r.aaText ? '  AA' : r.aaLarge ? '  AA-large' : '  FAIL'}`).join('\n'));
if (fails.length) { console.error('Contrast failures:', fails.map((f) => f.mode + ' ' + f.pair).join(', ')); process.exitCode = 1; }
