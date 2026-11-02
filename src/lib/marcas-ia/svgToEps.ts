/**
 * SVG → EPS (Encapsulated PostScript) VETORIAL genuíno.
 *
 * Escopo declarado: o BrandBot gera SVGs num subconjunto controlado (ver
 * prompt da edge marcas-ia-agent): rect, circle, ellipse, line, polygon,
 * polyline, path (comandos M/L/H/V/C/Q/Z, absolutos ou relativos) e text
 * (Arial/Helvetica). Cores em #RGB/#RRGGBB. Qualquer elemento fora do
 * subconjunto faz a conversão FALHAR ALTO (nunca rasterizar disfarçado).
 */

const PT_PER_UNIT = 2.83465; // 1px ≈ 1pt (mantemos 1:1 para simplicidade de bbox)

function hexToRgb(v: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hslToRgb(v: string): [number, number, number] | null {
  const m = /^hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?\s*[\s,]\s*(\d+(?:\.\d+)?)%\s*[\s,]\s*(\d+(?:\.\d+)?)%/i.exec(v.trim());
  if (!m) return null;
  const h = (((parseFloat(m[1]) % 360) + 360) % 360) / 360;
  const s = parseFloat(m[2]) / 100;
  const l = parseFloat(m[3]) / 100;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p2 = 2 * l - q;
  const f = (t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p2 + (q - p2) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p2 + (q - p2) * (2 / 3 - t) * 6;
    return p2;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

const NAMED: Record<string, [number, number, number]> = {
  white: [1, 1, 1], black: [0, 0, 0], red: [1, 0, 0], green: [0, 0.5019, 0], blue: [0, 0, 1],
};

function colorCmd(v: string | null): string | null {
  if (!v || v === 'none') return null;
  const rgb = hexToRgb(v) ?? hslToRgb(v) ?? NAMED[v.trim().toLowerCase()] ?? null;
  if (!rgb) throw new Error(`cor fora do subconjunto: ${v}`);
  return `${rgb[0].toFixed(4)} ${rgb[1].toFixed(4)} ${rgb[2].toFixed(4)} setrgbcolor`;
}

const num = (v: string | null, d = 0): number => {
  const n = parseFloat(v ?? '');
  return Number.isFinite(n) ? n : d;
};

/** Tokeniza e expande path data para comandos absolutos M/L/C/Z (H/V/Q/relativos convertidos). */
function pathToPs(d: string, h: number): string {
  const tokens = d.match(/[MmLlHhVvCcQqZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  let x = 0, y = 0, sx = 0, sy = 0;
  const X = (v: number) => (v * 1).toFixed(3);
  const Y = (v: number) => (h - v).toFixed(3);
  const read = (): number => {
    const t = tokens[i++];
    if (t === undefined || /[A-Za-z]/.test(t)) throw new Error('path malformado');
    return parseFloat(t);
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[A-Za-z]$/.test(t)) { cmd = t; i++; }
    if (cmd === 'Z' || cmd === 'z') { out.push('closepath'); x = sx; y = sy; cmd = ''; continue; }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    if (C === 'M' || C === 'L') {
      let nx = read(), ny = read();
      if (rel) { nx += x; ny += y; }
      out.push(`${X(nx)} ${Y(ny)} ${C === 'M' ? 'moveto' : 'lineto'}`);
      x = nx; y = ny;
      if (C === 'M') { sx = nx; sy = ny; cmd = rel ? 'l' : 'L'; }
    } else if (C === 'H') {
      let nx = read(); if (rel) nx += x;
      out.push(`${X(nx)} ${Y(y)} lineto`); x = nx;
    } else if (C === 'V') {
      let ny = read(); if (rel) ny += y;
      out.push(`${X(x)} ${Y(ny)} lineto`); y = ny;
    } else if (C === 'C') {
      let x1 = read(), y1 = read(), x2 = read(), y2 = read(), x3 = read(), y3 = read();
      if (rel) { x1 += x; y1 += y; x2 += x; y2 += y; x3 += x; y3 += y; }
      out.push(`${X(x1)} ${Y(y1)} ${X(x2)} ${Y(y2)} ${X(x3)} ${Y(y3)} curveto`);
      x = x3; y = y3;
    } else if (C === 'Q') {
      let x1 = read(), y1 = read(), x2 = read(), y2 = read();
      if (rel) { x1 += x; y1 += y; x2 += x; y2 += y; }
      const c1x = x + (2 / 3) * (x1 - x), c1y = y + (2 / 3) * (y1 - y);
      const c2x = x2 + (2 / 3) * (x1 - x2), c2y = y2 + (2 / 3) * (y1 - y2);
      out.push(`${X(c1x)} ${Y(c1y)} ${X(c2x)} ${Y(c2y)} ${X(x2)} ${Y(y2)} curveto`);
      x = x2; y = y2;
    } else if (C === 'A' || C === 'S' || C === 'T') {
      throw new Error(`comando de path fora do subconjunto: ${C}`);
    } else if (!cmd) {
      throw new Error('path sem comando inicial');
    }
  }
  return out.join('\n');
}

function paintAttrs(el: Element): { fill: string; stroke: string | null; width: number } {
  const fill = el.getAttribute('fill') ?? 'black';
  const stroke = el.getAttribute('stroke');
  const width = num(el.getAttribute('stroke-width'), 1);
  return { fill, stroke, width };
}

function emitShape(el: Element, h: number): string {
  const tag = el.tagName.toLowerCase();
  const { fill, stroke, width } = paintAttrs(el);
  const ops: string[] = [];
  const paint = () => {
    const f = colorCmd(fill);
    const s = stroke ? colorCmd(stroke) : null;
    if (f && s) { ops.push('gsave', f, 'fill', 'grestore', s, `${width} setlinewidth`, 'stroke'); }
    else if (f) ops.push(f, 'fill');
    else if (s) ops.push(s, `${width} setlinewidth`, 'stroke');
    else ops.push('0 0 0 setrgbcolor', 'fill');
  };
  if (tag === 'rect') {
    const x = num(el.getAttribute('x')), y = num(el.getAttribute('y'));
    const w = num(el.getAttribute('width')), ht = num(el.getAttribute('height'));
    const rx = num(el.getAttribute('rx'));
    if (rx > 0) {
      // retângulo arredondado via arcos aproximados por curvas cúbicas (kappa)
      const k = 0.5522847498;
      const r = Math.min(rx, w / 2, ht / 2);
      const top = h - y, left = x;
      ops.push(
        `newpath`, `${(left + r).toFixed(3)} ${top.toFixed(3)} moveto`,
        `${(left + w - r).toFixed(3)} ${top.toFixed(3)} lineto`,
        `${(left + w - r + k * r).toFixed(3)} ${top.toFixed(3)} ${(left + w).toFixed(3)} ${(top - r + k * r).toFixed(3)} ${(left + w).toFixed(3)} ${(top - r).toFixed(3)} curveto`,
        `${(left + w).toFixed(3)} ${(top - ht + r).toFixed(3)} lineto`,
        `${(left + w).toFixed(3)} ${(top - ht + r - k * r).toFixed(3)} ${(left + w - r + k * r).toFixed(3)} ${(top - ht).toFixed(3)} ${(left + w - r).toFixed(3)} ${(top - ht).toFixed(3)} curveto`,
        `${(left + r).toFixed(3)} ${(top - ht).toFixed(3)} lineto`,
        `${(left + r - k * r).toFixed(3)} ${(top - ht).toFixed(3)} ${left.toFixed(3)} ${(top - ht + r - k * r).toFixed(3)} ${left.toFixed(3)} ${(top - ht + r).toFixed(3)} curveto`,
        `${left.toFixed(3)} ${(top - r).toFixed(3)} lineto`,
        `${left.toFixed(3)} ${(top - r + k * r).toFixed(3)} ${(left + r - k * r).toFixed(3)} ${top.toFixed(3)} ${(left + r).toFixed(3)} ${top.toFixed(3)} curveto`,
        'closepath',
      );
    } else {
      ops.push('newpath', `${x.toFixed(3)} ${(h - y).toFixed(3)} moveto`, `${(x + w).toFixed(3)} ${(h - y).toFixed(3)} lineto`, `${(x + w).toFixed(3)} ${(h - y - ht).toFixed(3)} lineto`, `${x.toFixed(3)} ${(h - y - ht).toFixed(3)} lineto`, 'closepath');
    }
    paint();
    return ops.join('\n');
  }
  if (tag === 'circle' || tag === 'ellipse') {
    const cx = num(el.getAttribute('cx')), cy = num(el.getAttribute('cy'));
    const rx = tag === 'circle' ? num(el.getAttribute('r')) : num(el.getAttribute('rx'));
    const ry = tag === 'circle' ? num(el.getAttribute('r')) : num(el.getAttribute('ry'));
    const k = 0.5522847498;
    const X = (v: number) => v.toFixed(3);
    const Y = (v: number) => (h - v).toFixed(3);
    ops.push(
      'newpath', `${X(cx + rx)} ${Y(cy)} moveto`,
      `${X(cx + rx)} ${Y(cy - k * ry)} ${X(cx + k * rx)} ${Y(cy - ry)} ${X(cx)} ${Y(cy - ry)} curveto`,
      `${X(cx - k * rx)} ${Y(cy - ry)} ${X(cx - rx)} ${Y(cy - k * ry)} ${X(cx - rx)} ${Y(cy)} curveto`,
      `${X(cx - rx)} ${Y(cy + k * ry)} ${X(cx - k * rx)} ${Y(cy + ry)} ${X(cx)} ${Y(cy + ry)} curveto`,
      `${X(cx + k * rx)} ${Y(cy + ry)} ${X(cx + rx)} ${Y(cy + k * ry)} ${X(cx + rx)} ${Y(cy)} curveto`,
      'closepath',
    );
    paint();
    return ops.join('\n');
  }
  if (tag === 'line') {
    const x1 = num(el.getAttribute('x1')), y1 = num(el.getAttribute('y1'));
    const x2 = num(el.getAttribute('x2')), y2 = num(el.getAttribute('y2'));
    const s = colorCmd(stroke ?? fill) ?? '0 0 0 setrgbcolor';
    return ['newpath', `${x1.toFixed(3)} ${(h - y1).toFixed(3)} moveto`, `${x2.toFixed(3)} ${(h - y2).toFixed(3)} lineto`, s, `${width} setlinewidth`, 'stroke'].join('\n');
  }
  if (tag === 'polygon' || tag === 'polyline') {
    const pts = (el.getAttribute('points') ?? '').trim().split(/[\s,]+/).map(parseFloat);
    if (pts.length < 4 || pts.some((p) => !Number.isFinite(p))) throw new Error(`${tag} malformado`);
    const ops2 = ['newpath', `${pts[0].toFixed(3)} ${(h - pts[1]).toFixed(3)} moveto`];
    for (let i = 2; i < pts.length; i += 2) ops2.push(`${pts[i].toFixed(3)} ${(h - pts[i + 1]).toFixed(3)} lineto`);
    if (tag === 'polygon') ops2.push('closepath');
    ops.push(...ops2);
    paint();
    return ops.join('\n');
  }
  if (tag === 'path') {
    const d = el.getAttribute('d');
    if (!d) throw new Error('path sem d');
    ops.push('newpath', pathToPs(d, h));
    const hasClose = /[Zz]\s*$/.test(d.trim()) || fill !== 'none';
    if (hasClose && fill !== 'none') ops.push('closepath');
    paint();
    return ops.join('\n');
  }
  if (tag === 'text') {
    const x = num(el.getAttribute('x')), y = num(el.getAttribute('y'));
    const size = num(el.getAttribute('font-size'), 16);
    const anchor = el.getAttribute('text-anchor') ?? 'start';
    const content = (el.textContent ?? '').replace(/[()\\]/g, (c) => '\\' + c);
    const f = colorCmd(fill === 'none' ? 'black' : fill) ?? '0 0 0 setrgbcolor';
    const ops3 = [f, `/Helvetica findfont ${size.toFixed(2)} scalefont setfont`];
    if (anchor === 'middle') ops3.push(`(${content}) dup stringwidth pop 2 div neg ${x.toFixed(3)} add ${(h - y).toFixed(3)} moveto show`);
    else if (anchor === 'end') ops3.push(`(${content}) dup stringwidth pop neg ${x.toFixed(3)} add ${(h - y).toFixed(3)} moveto show`);
    else ops3.push(`${x.toFixed(3)} ${(h - y).toFixed(3)} moveto (${content}) show`);
    return ops3.join('\n');
  }
  throw new Error(`elemento SVG fora do subconjunto suportado: <${tag}>`);
}

/** Converte um SVG (string) do subconjunto BrandBot para EPS vetorial. Lança erro em elemento não suportado. */
export function svgToEps(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.querySelector('svg');
  if (!root) throw new Error('SVG inválido');
  if (doc.querySelector('parsererror')) throw new Error('SVG malformado');
  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(parseFloat);
  const w = vb.length === 4 ? vb[2] : num(root.getAttribute('width'), 240);
  const h = vb.length === 4 ? vb[3] : num(root.getAttribute('height'), 240);
  if (!(w > 0) || !(h > 0)) throw new Error('SVG sem dimensões');
  const W = w, H = h;
  const body: string[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'g') { walk(child); continue; }
      if (tag === 'defs' || tag === 'title' || tag === 'desc') continue;
      if (tag === 'script' || tag === 'image' || tag === 'foreignobject' || tag === 'use' || tag === 'lineargradient' || tag === 'radialgradient' || tag === 'pattern' || tag === 'mask' || tag === 'clippath' || tag === 'filter' || tag === 'style') {
        throw new Error(`elemento SVG fora do subconjunto suportado: <${tag}>`);
      }
      body.push(emitShape(child, H));
    }
  };
  if (vb.length === 4 && (vb[0] !== 0 || vb[1] !== 0)) {
    body.push(`${(-vb[0]).toFixed(3)} ${vb[1].toFixed(3)} translate`);
  }
  walk(root);
  const bw = (W * 1).toFixed(3), bh = (H * 1).toFixed(3);
  return `%!PS-Adobe-3.0 EPSF-3.0
%%Creator: WebMarcas BrandBot (SVG vetorial -> EPS)
%%BoundingBox: 0 0 ${Math.ceil(W)} ${Math.ceil(H)}
%%HiResBoundingBox: 0 0 ${bw} ${bh}
%%LanguageLevel: 2
%%Pages: 1
%%EndComments
%%Page: 1 1
gsave
${PT_PER_UNIT / PT_PER_UNIT === 1 ? '' : ''}${body.join('\n')}
grestore
showpage
%%EOF
`;
}
