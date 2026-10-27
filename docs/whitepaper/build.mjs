// Builds the litepaper from content.mjs into:
//   docs/CYBERHOOD_Genesis_Economy_UniswapV4_Hook.docx
//   web/assets/docs/<same>.docx   (download on the site)
//   web/docs.html                 (readable page on the site)
// Run: node docs/whitepaper/build.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { META, DOC } from './content.mjs';

const require = createRequire(import.meta.url);
const d = require('docx');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const NAME = 'CYBERHOOD_Genesis_Economy_UniswapV4_Hook.docx';

/* ---------------- inline markup ---------------- */
// **bold** and `code` → [{text, bold, code}]
function spans(s) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    const tok = m[0];
    out.push(tok.startsWith('**') ? { text: tok.slice(2, -2), bold: true } : { text: tok.slice(1, -1), code: true });
    last = m.index + tok.length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/* ---------------- DOCX ---------------- */
const INK = '1B1530', PINK = 'E0207A', CYAN = '0AA5BF', MUTED = '5E5876', LINE = 'D9D4E8', HEAD = '1A1033', ZEBRA = 'F5F3FA';
const FONT = 'Arial', MONO = 'Consolas';
const W = 9638; // A4 content width in DXA with 2 cm margins

const runs = (s, o = {}) => spans(s).map((x) => new d.TextRun({ text: x.text, bold: x.bold || o.bold, font: x.code ? MONO : FONT, size: o.size, color: x.code ? PINK : o.color }));
const para = (s, o = {}) => new d.Paragraph({ children: runs(s, o), spacing: { after: 140, line: 300 }, ...o.p });

function table(head, rows, frac) {
  const n = head.length;
  // first column narrower for 3+ column tables, wide text in the last column
  const widths = frac ? frac.map((f) => W * f) : n === 2 ? [W * 0.55, W * 0.45] : n === 3 ? [W * 0.26, W * 0.2, W * 0.54] : Array(n).fill(W / n);
  const cw = widths.map((x) => Math.round(x));
  cw[cw.length - 1] += W - cw.reduce((a, b) => a + b, 0);
  const border = { style: d.BorderStyle.SINGLE, size: 4, color: LINE };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (txt, i, hdr, zebra) => new d.TableCell({
    width: { size: cw[i], type: d.WidthType.DXA },
    borders,
    shading: hdr ? { type: d.ShadingType.CLEAR, color: 'auto', fill: HEAD } : zebra ? { type: d.ShadingType.CLEAR, color: 'auto', fill: ZEBRA } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new d.Paragraph({ children: runs(txt, { bold: hdr, color: hdr ? 'FFFFFF' : INK, size: 19 }) })],
  });
  return new d.Table({
    width: { size: W, type: d.WidthType.DXA },
    columnWidths: cw,
    rows: [
      new d.TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r, k) => new d.TableRow({ children: r.map((c, i) => cell(c, i, false, k % 2 === 1)) })),
    ],
  });
}

function codeBlock(title, text) {
  const out = [];
  if (title) out.push(new d.Paragraph({ children: [new d.TextRun({ text: title.toUpperCase(), font: MONO, size: 16, color: CYAN, bold: true })], spacing: { before: 120, after: 60 } }));
  text.split('\n').forEach((line, i, all) => out.push(new d.Paragraph({
    children: [new d.TextRun({ text: line || ' ', font: MONO, size: 16, color: 'E9E6F5' })],
    shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: '15102A' },
    spacing: { before: i === 0 ? 0 : 0, after: i === all.length - 1 ? 200 : 0, line: 252 },
    indent: { left: 120, right: 120 },
  })));
  return out;
}

function kpis(items) {
  const cols = 3, cw = Math.floor(W / cols);
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(new d.TableRow({ children: items.slice(i, i + cols).map(([v, k]) => new d.TableCell({
      width: { size: cw, type: d.WidthType.DXA },
      borders: { top: { style: d.BorderStyle.SINGLE, size: 12, color: PINK }, bottom: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' } },
      margins: { top: 120, bottom: 160, left: 100, right: 100 },
      children: [
        new d.Paragraph({ children: [new d.TextRun({ text: v, font: FONT, size: 34, bold: true, color: INK })] }),
        new d.Paragraph({ children: [new d.TextRun({ text: k, font: FONT, size: 17, color: MUTED })] }),
      ],
    })) }));
  }
  return new d.Table({ width: { size: cw * cols, type: d.WidthType.DXA }, columnWidths: Array(cols).fill(cw), rows });
}

function note(text) {
  return new d.Paragraph({
    children: runs(text, { color: INK, size: 19 }),
    shading: { type: d.ShadingType.CLEAR, color: 'auto', fill: 'FDEAF3' },
    border: { left: { style: d.BorderStyle.SINGLE, size: 24, color: PINK, space: 8 } },
    spacing: { before: 120, after: 200, line: 288 },
    indent: { left: 160, right: 120 },
  });
}

let listN = 0;
function docxChildren() {
  const out = [];
  for (const b of DOC) {
    if (b.t === 'h1') out.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_1, children: [new d.Bookmark({ id: 'b_' + b.id, children: [new d.TextRun(b.text)] })], pageBreakBefore: ['hook', 'genesis', 'parameters', 'appendix'].includes(b.id) }));
    else if (b.t === 'h2') out.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, children: [new d.Bookmark({ id: 'b_' + b.id, children: [new d.TextRun(b.text)] })] }));
    else if (b.t === 'h3') out.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_3, children: [new d.TextRun(b.text)] }));
    else if (b.t === 'p') out.push(para(b.text, { color: INK, size: 21 }));
    else if (b.t === 'note') out.push(note(b.text));
    else if (b.t === 'list') { const inst = ++listN; b.items.forEach((it) => out.push(new d.Paragraph({ children: runs(it, { color: INK, size: 21 }), numbering: b.ordered ? { reference: 'steps', level: 0, instance: inst } : { reference: 'dots', level: 0 }, spacing: { after: 80, line: 288 } }))); }
    else if (b.t === 'table') { out.push(table(b.head, b.rows, b.w)); out.push(new d.Paragraph({ spacing: { after: 160 } })); }
    else if (b.t === 'code') out.push(...codeBlock(b.title, b.text));
    else if (b.t === 'kpis') { out.push(kpis(b.items)); out.push(new d.Paragraph({ spacing: { after: 120 } })); }
  }
  return out;
}

async function buildDocx() {
  const cover = fs.readFileSync(path.join(HERE, 'cover.jpg'));
  const doc = new d.Document({
    creator: 'CYBERHOOD',
    title: `${META.title} — ${META.subtitle}`,
    description: META.version,
    styles: {
      default: { document: { run: { font: FONT, size: 21, color: INK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 36, bold: true, font: FONT, color: INK }, paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0, border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: PINK, space: 6 } } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 27, bold: true, font: FONT, color: '2B1F55' }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 23, bold: true, font: FONT, color: CYAN }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } },
      ],
    },
    numbering: { config: [
      { reference: 'dots', levels: [{ level: 0, format: d.LevelFormat.BULLET, text: '▸', alignment: d.AlignmentType.LEFT, style: { run: { color: PINK }, paragraph: { indent: { left: 440, hanging: 300 } } } }] },
      { reference: 'steps', levels: [{ level: 0, format: d.LevelFormat.DECIMAL, text: '%1.', alignment: d.AlignmentType.LEFT, style: { run: { color: PINK, bold: true }, paragraph: { indent: { left: 440, hanging: 340 } } } }] },
    ] },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        children: [
          new d.Paragraph({ children: [new d.ImageRun({ type: 'jpg', data: cover, transformation: { width: 642, height: 361 } })], spacing: { after: 360 } }),
          new d.Paragraph({ children: [new d.TextRun({ text: 'CYBER', font: FONT, size: 30, bold: true, color: CYAN }), new d.TextRun({ text: 'HOOD', font: FONT, size: 30, bold: true, color: PINK })], spacing: { after: 120 } }),
          new d.Paragraph({ children: [new d.TextRun({ text: META.title, font: FONT, size: 64, bold: true, color: INK })], spacing: { after: 160 } }),
          new d.Paragraph({ children: [new d.TextRun({ text: META.subtitle, font: FONT, size: 30, color: '2B1F55' })], spacing: { after: 480 } }),
          new d.Paragraph({ children: [new d.TextRun({ text: META.version, font: FONT, size: 22, bold: true, color: PINK })], spacing: { after: 60 } }),
          new d.Paragraph({ children: [new d.TextRun({ text: META.date, font: FONT, size: 22, color: MUTED })], spacing: { after: 360 } }),
          note(META.status),
          new d.Paragraph({ children: [new d.PageBreak()] }),
          new d.Paragraph({ children: [new d.TextRun({ text: 'Contents', font: FONT, size: 36, bold: true, color: INK })], spacing: { after: 200 } }),
          ...DOC.filter((b) => b.t === 'h1' || b.t === 'h2').map((b) => new d.Paragraph({ indent: { left: b.t === 'h2' ? 360 : 0 }, spacing: { after: b.t === 'h1' ? 100 : 40, before: b.t === 'h1' ? 120 : 0 }, children: [new d.InternalHyperlink({ anchor: 'b_' + b.id, children: [new d.TextRun({ text: b.text, font: FONT, size: b.t === 'h1' ? 23 : 20, bold: b.t === 'h1', color: b.t === 'h1' ? INK : MUTED })] })] })),
          new d.Paragraph({ children: [new d.PageBreak()] }),
        ],
      },
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        headers: { default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun({ text: `${META.title} · ${META.version}`, font: FONT, size: 16, color: MUTED })] })] }) },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], font: FONT, size: 16, color: MUTED })] })] }) },
        children: docxChildren(),
      },
    ],
  });
  const out = path.join(ROOT, 'docs', NAME);
  fs.writeFileSync(out, await d.Packer.toBuffer(doc));
  execFileSync('python3', [path.join(HERE, 'fixids.py'), out]);
  const buf = fs.readFileSync(out);
  fs.mkdirSync(path.join(ROOT, 'web/assets/docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'web/assets/docs', NAME), buf);
  return buf.length;
}

/* ---------------- HTML page ---------------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inl = (s) => spans(s).map((x) => (x.bold ? `<b>${esc(x.text)}</b>` : x.code ? `<code>${esc(x.text)}</code>` : esc(x.text))).join('');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function htmlBody() {
  const out = [];
  for (const b of DOC) {
    if (b.t === 'h1') out.push(`<h2 class="d-h1" id="${b.id}">${esc(b.text)}</h2>`);
    else if (b.t === 'h2') out.push(`<h3 class="d-h2" id="${b.id || slug(b.text)}">${esc(b.text)}</h3>`);
    else if (b.t === 'h3') out.push(`<h4 class="d-h3">${esc(b.text)}</h4>`);
    else if (b.t === 'p') out.push(`<p>${inl(b.text)}</p>`);
    else if (b.t === 'note') out.push(`<p class="d-note">${inl(b.text)}</p>`);
    else if (b.t === 'list') out.push(`<${b.ordered ? 'ol' : 'ul'} class="d-list">${b.items.map((i) => `<li>${inl(i)}</li>`).join('')}</${b.ordered ? 'ol' : 'ul'}>`);
    else if (b.t === 'table') out.push(`<div class="d-tbl"><table><thead><tr>${b.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
    else if (b.t === 'code') out.push(`<figure class="d-code">${b.title ? `<figcaption>${esc(b.title)}</figcaption>` : ''}<pre><code>${esc(b.text)}</code></pre></figure>`);
    else if (b.t === 'kpis') out.push(`<div class="d-kpis">${b.items.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`);
  }
  return out.join('\n');
}

function buildHtml(size) {
  const toc = DOC.filter((b) => b.t === 'h1' || b.t === 'h2').map((b) => `<a href="#${b.id || slug(b.text)}" class="${b.t === 'h2' ? 'sub' : ''}">${esc(b.text)}</a>`).join('');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>CYBERHOOD Litepaper</title>
<meta name="description" content="${esc(META.title)}: ${esc(META.subtitle)}.">
<link rel="icon" href="assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&display=swap">
<link rel="stylesheet" href="assets/css/page.css">
<link rel="stylesheet" href="assets/css/docs.css">
</head>
<body class="docs">
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><symbol id="i-brand" viewBox="0 0 30 12"><path fill="currentColor" d="M0 6 6 0h18l6 6-6 6H6zM8 3 5 6l3 3h14l3-3-3-3z"/></symbol></svg>
<div class="top"><div class="wrap">
  <a class="logo" href="index.html" aria-label="CYBERHOOD home"><svg><use href="#i-brand"/></svg><span><span class="c">CYBER</span><span class="p">HOOD</span></span></a>
  <nav class="nav" aria-label="Site"><a href="index.html#modes">Game modes</a><a href="index.html#season">Season 0</a><a href="index.html#market">Marketplace</a><a href="docs.html" aria-current="page">Litepaper</a></nav>
  <div class="acts"><a class="btn primary small" href="assets/docs/${NAME.replace('.docx', '.pdf')}" download>Download PDF</a></div>
</div></div>

<header class="d-hero" id="top"><div class="wrap">
  <span class="eyebrow"><b>Docs</b> · ${esc(META.version)}</span>
  <h1>${esc(META.title)}</h1>
  <p class="sub">${esc(META.subtitle)}</p>
  <div class="ctas"><a class="btn primary" href="assets/docs/${NAME.replace('.docx', '.pdf')}" download>Download PDF</a><a class="btn ghost dl-docx" href="assets/docs/${NAME}" download>Word .docx · ${Math.round(size / 1024)} KB</a><a class="btn ghost" href="index.html">Back to the site</a></div>
  <p class="d-status">${esc(META.date)} · ${esc(META.status)}</p>
</div></header>

<div class="wrap d-layout">
  <aside class="d-toc" aria-label="Contents"><span class="eyebrow">Contents</span><nav>${toc}</nav></aside>
  <article class="d-body">
${htmlBody()}
    <div class="d-end"><a class="btn primary" href="assets/docs/${NAME.replace('.docx', '.pdf')}" download>Download PDF</a><a class="btn ghost dl-docx" href="assets/docs/${NAME}" download>Word .docx</a><a class="btn ghost" href="#top">Back to top</a></div>
  </article>
</div>

<footer><div class="wrap"><span>We don't drop tokens. We drop loot.</span><span><a href="index.html">Home</a> · <a href="docs.html">Litepaper</a></span><span>CYBERHOOD © 2026</span></div></footer>
<script src="assets/js/docs.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'web/docs.html'), html);
}

const size = await buildDocx();
const PDF = NAME.replace(/\.docx$/, '.pdf');
try {
  const out = path.join(ROOT, 'web/assets/docs');
  execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, path.join(out, NAME)], { stdio: 'ignore' });
} catch (e) { console.warn('PDF export skipped:', e.message); }
buildHtml(size);
console.log('docx', size, 'bytes · web/docs.html written');
