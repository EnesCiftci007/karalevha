import { useEffect, useRef, useState } from 'react';
import { Box, Eye, Loader2, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface Kicad3DViewProps {
  url: string;
}

type MaskColorId = 'mor' | 'yesil' | 'siyah' | 'mavi' | 'kirmizi';

const MASK_PALETTES: Record<MaskColorId, { label: string; swatch: string; mask: string; trace: string; edge: number }> = {
  mor:     { label: 'Mor',     swatch: '#4a1d6e', mask: '#351154', trace: '#562285', edge: 0x7a724e },
  yesil:   { label: 'Yeşil',   swatch: '#136b33', mask: '#0b4a22', trace: '#197a3d', edge: 0x878056 },
  siyah:   { label: 'Siyah',   swatch: '#1d1f22', mask: '#15171a', trace: '#272b31', edge: 0x6b6648 },
  mavi:    { label: 'Mavi',    swatch: '#12468a', mask: '#0a3166', trace: '#1856a8', edge: 0x878056 },
  kirmizi: { label: 'Kırmızı', swatch: '#8f1d1d', mask: '#6b1111', trace: '#a62222', edge: 0x878056 },
};

/* ---------------- Minimal S-expression parser for .kicad_pcb ---------------- */

type SExpr = string | SExpr[];

function parseSExpr(input: string): SExpr[] {
  const tokens: string[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch <= ' ') { i++; continue; }
    if (ch === '(' || ch === ')') { tokens.push(ch); i++; continue; }
    if (ch === '"') {
      let s = '';
      i++;
      while (i < n && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < n) { s += input[i + 1]; i += 2; }
        else { s += input[i++]; }
      }
      i++;
      tokens.push(s);
    } else {
      let s = '';
      while (i < n && input[i] > ' ' && input[i] !== '(' && input[i] !== ')') s += input[i++];
      tokens.push(s);
    }
  }
  const stack: SExpr[][] = [[]];
  for (const tok of tokens) {
    if (tok === '(') {
      const node: SExpr[] = [];
      stack[stack.length - 1].push(node);
      stack.push(node);
    } else if (tok === ')') {
      if (stack.length > 1) stack.pop();
    } else {
      stack[stack.length - 1].push(tok);
    }
  }
  return stack[0];
}

const findChild = (node: SExpr[], tag: string): SExpr[] | undefined =>
  node.find((c): c is SExpr[] => Array.isArray(c) && c[0] === tag);

const findChildren = (node: SExpr[], tag: string): SExpr[][] =>
  node.filter((c): c is SExpr[] => Array.isArray(c) && c[0] === tag);

const num = (v: SExpr | undefined, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ---------------- Parsed PCB Data ---------------- */

interface ParsedPad {
  x: number; y: number;
  w: number; h: number;
  shape: string;
  type: string;
  drill: number;
  layers: string[];
}

interface ParsedFootprint {
  lib: string;
  ref: string;
  value: string;
  refAt?: [number, number];
  x: number; y: number; rot: number;
  side: 'top' | 'bottom';
  pads: ParsedPad[];
  silkLines: [number, number, number, number][];
  silkRects: [number, number, number, number][];
}

interface ParsedSegment { x1: number; y1: number; x2: number; y2: number; w: number; side: 'top' | 'bottom'; }
interface ParsedVia { x: number; y: number; size: number; drill: number; }
interface ParsedText { text: string; x: number; y: number; size: number; side: 'top' | 'bottom'; }
interface ParsedBoard {
  minX: number; minY: number; maxX: number; maxY: number;
  thickness: number;
  footprints: ParsedFootprint[];
  segments: ParsedSegment[];
  vias: ParsedVia[];
  texts: ParsedText[];
  holes: { x: number; y: number; r: number; plated: boolean }[];
}

function parseKicadPcb(src: string): ParsedBoard {
  const roots = parseSExpr(src);
  const root = roots.find((n): n is SExpr[] => Array.isArray(n) && n[0] === 'kicad_pcb');
  if (!root) throw new Error('Geçerli bir KiCad 6+ PCB dosyası değil.');

  const general = findChild(root, 'general');
  const thickness = num(findChild(general ?? [], 'thickness')?.[1], 1.6);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };

  for (const r of findChildren(root, 'gr_rect')) {
    if (String(findChild(r, 'layer')?.[1] ?? '') !== 'Edge.Cuts') continue;
    const st = findChild(r, 'start'); const en = findChild(r, 'end');
    if (st && en) { expand(num(st[1]), num(st[2])); expand(num(en[1]), num(en[2])); }
  }
  for (const l of findChildren(root, 'gr_line')) {
    if (String(findChild(l, 'layer')?.[1] ?? '') !== 'Edge.Cuts') continue;
    const st = findChild(l, 'start'); const en = findChild(l, 'end');
    if (st && en) { expand(num(st[1]), num(st[2])); expand(num(en[1]), num(en[2])); }
  }

  const segments: ParsedSegment[] = [];
  for (const s of findChildren(root, 'segment')) {
    const st = findChild(s, 'start'); const en = findChild(s, 'end');
    const layer = String(findChild(s, 'layer')?.[1] ?? 'F.Cu');
    if (!st || !en) continue;
    segments.push({
      x1: num(st[1]), y1: num(st[2]), x2: num(en[1]), y2: num(en[2]),
      w: num(findChild(s, 'width')?.[1], 0.25),
      side: layer.startsWith('B.') ? 'bottom' : 'top',
    });
  }

  const vias: ParsedVia[] = [];
  for (const v of findChildren(root, 'via')) {
    const at = findChild(v, 'at');
    if (!at) continue;
    vias.push({ x: num(at[1]), y: num(at[2]), size: num(findChild(v, 'size')?.[1], 0.8), drill: num(findChild(v, 'drill')?.[1], 0.4) });
  }

  const texts: ParsedText[] = [];
  for (const t of findChildren(root, 'gr_text')) {
    const text = String(t[1] ?? '');
    const at = findChild(t, 'at');
    const layer = String(findChild(t, 'layer')?.[1] ?? '');
    if (!at || !layer.includes('Silk')) continue;
    const eff = findChild(t, 'effects');
    const font = findChild(eff ?? [], 'font');
    const sz = findChild(font ?? [], 'size');
    texts.push({ text, x: num(at[1]), y: num(at[2]), size: num(sz?.[1], 1.2), side: layer.startsWith('B.') ? 'bottom' : 'top' });
  }

  const footprints: ParsedFootprint[] = [];
  const holes: { x: number; y: number; r: number; plated: boolean }[] = [];

  for (const fp of findChildren(root, 'footprint')) {
    const lib = String(fp[1] ?? '');
    const layer = String(findChild(fp, 'layer')?.[1] ?? 'F.Cu');
    const at = findChild(fp, 'at');
    const fx = num(at?.[1]); const fy = num(at?.[2]); const rot = num(at?.[3]);
    const side: 'top' | 'bottom' = layer.startsWith('B.') ? 'bottom' : 'top';

    let ref = ''; let value = '';
    let refAt: [number, number] | undefined;
    for (const ft of findChildren(fp, 'fp_text')) {
      if (ft[1] === 'reference') {
        ref = String(ft[2] ?? '');
        const rat = findChild(ft, 'at');
        if (rat) refAt = [num(rat[1]), num(rat[2])];
      }
      if (ft[1] === 'value') value = String(ft[2] ?? '');
    }
    for (const prop of findChildren(fp, 'property')) {
      if (prop[1] === 'Reference') {
        ref = String(prop[2] ?? '');
        const rat = findChild(prop, 'at');
        if (rat) refAt = [num(rat[1]), num(rat[2])];
      }
      if (prop[1] === 'Value') value = String(prop[2] ?? '');
    }

    const pads: ParsedPad[] = [];
    const rad = (-rot * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);

    for (const p of findChildren(fp, 'pad')) {
      const pType = String(p[2] ?? 'smd');
      const shape = String(p[3] ?? 'rect');
      const pat = findChild(p, 'at');
      const psz = findChild(p, 'size');
      const pdr = findChild(p, 'drill');
      const ply = findChild(p, 'layers');
      const px = num(pat?.[1]); const py = num(pat?.[2]);
      const drill = num(pdr?.[1], 0);
      pads.push({
        x: px, y: py, w: num(psz?.[1], 1), h: num(psz?.[2], 1),
        shape, type: pType, drill,
        layers: ply ? ply.slice(1).map(String) : ['F.Cu'],
      });
      if (drill >= 0.65) {
        const wx = fx + px * cos - py * sin;
        const wy = fy + px * sin + py * cos;
        holes.push({ x: wx, y: wy, r: drill / 2, plated: pType !== 'np_thru_hole' });
      }
    }

    const silkLines: [number, number, number, number][] = [];
    for (const l of findChildren(fp, 'fp_line')) {
      if (!String(findChild(l, 'layer')?.[1] ?? '').includes('Silk')) continue;
      const st = findChild(l, 'start'); const en = findChild(l, 'end');
      if (st && en) silkLines.push([num(st[1]), num(st[2]), num(en[1]), num(en[2])]);
    }
    const silkRects: [number, number, number, number][] = [];
    for (const r of findChildren(fp, 'fp_rect')) {
      if (!String(findChild(r, 'layer')?.[1] ?? '').includes('Silk')) continue;
      const st = findChild(r, 'start'); const en = findChild(r, 'end');
      if (st && en) silkRects.push([num(st[1]), num(st[2]), num(en[1]), num(en[2])]);
    }

    footprints.push({ lib, ref, value, refAt, x: fx, y: fy, rot, side, pads, silkLines, silkRects });
  }

  if (!Number.isFinite(minX)) {
    for (const fp of footprints) expand(fp.x, fp.y);
    for (const s of segments) { expand(s.x1, s.y1); expand(s.x2, s.y2); }
    minX -= 5; minY -= 5; maxX += 5; maxY += 5;
  }

  return { minX, minY, maxX, maxY, thickness, footprints, segments, vias, texts, holes };
}

/* ---------------- PBR Maps (Color + Metalness + Roughness + Bump + FR-4 Weave + Baked AO) ---------------- */

function buildBoardMaps(board: ParsedBoard, side: 'top' | 'bottom', palette: (typeof MASK_PALETTES)[MaskColorId], maxAniso: number) {
  const bw = Math.max(1, board.maxX - board.minX);
  const bh = Math.max(1, board.maxY - board.minY);
  const maxTex = 2048;
  const pxPerMm = maxTex / Math.max(bw, bh);
  const cw = Math.max(256, Math.round(bw * pxPerMm));
  const ch = Math.max(256, Math.round(bh * pxPerMm));

  const makeCanvas = () => {
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    return c;
  };
  const colorCanvas = makeCanvas();
  const metalCanvas = makeCanvas();
  const roughCanvas = makeCanvas();
  const bumpCanvas = makeCanvas();

  const ctx = colorCanvas.getContext('2d')!;
  const mctx = metalCanvas.getContext('2d')!;
  const rctx = roughCanvas.getContext('2d')!;
  const bctx = bumpCanvas.getContext('2d')!;

  // Base solder mask
  ctx.fillStyle = palette.mask; ctx.fillRect(0, 0, cw, ch);
  mctx.fillStyle = '#0e0e0e'; mctx.fillRect(0, 0, cw, ch);
  rctx.fillStyle = '#525252'; rctx.fillRect(0, 0, cw, ch);
  bctx.fillStyle = '#4c4c4c'; bctx.fillRect(0, 0, cw, ch);

  // Subtle FR-4 woven fiberglass micro-texture
  const weaveStep = Math.max(6, Math.round(0.32 * pxPerMm));
  ctx.fillStyle = 'rgba(255,255,255,0.022)';
  bctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < ch; y += weaveStep) {
    ctx.fillRect(0, y, cw, 1);
    bctx.fillRect(0, y, cw, 1);
  }
  for (let x = 0; x < cw; x += weaveStep) {
    ctx.fillRect(x, 0, 1, ch);
    bctx.fillRect(x, 0, 1, ch);
  }

  const tx = (x: number) => (side === 'top' ? x - board.minX : board.maxX - x) * pxPerMm;
  const ty = (y: number) => (y - board.minY) * pxPerMm;

  // 1. Copper traces under solder mask (subtle 3D ridge in bump + glossy clearcoat ridge)
  for (const [target, color] of [[ctx, palette.trace], [bctx, '#c4c4c4'], [rctx, '#3c3c3c']] as [CanvasRenderingContext2D, string][]) {
    target.strokeStyle = color;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    for (const seg of board.segments) {
      if (seg.side !== side) continue;
      target.lineWidth = Math.max(1.7, seg.w * pxPerMm);
      target.beginPath();
      target.moveTo(tx(seg.x1), ty(seg.y1));
      target.lineTo(tx(seg.x2), ty(seg.y2));
      target.stroke();
    }
  }

  // 2. Soft baked Ambient Occlusion (contact shadows) underneath each component on this side
  for (const fp of board.footprints) {
    if (fp.side !== side || fp.lib.toLowerCase().includes('mountinghole')) continue;
    let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
    for (const p of fp.pads) {
      pMinX = Math.min(pMinX, p.x - p.w / 2); pMaxX = Math.max(pMaxX, p.x + p.w / 2);
      pMinY = Math.min(pMinY, p.y - p.h / 2); pMaxY = Math.max(pMaxY, p.y + p.h / 2);
    }
    if (!Number.isFinite(pMinX)) continue;
    const rad = (-fp.rot * Math.PI) / 180;
    const w = Math.max(1.8, pMaxX - pMinX) * pxPerMm;
    const h = Math.max(1.8, pMaxY - pMinY) * pxPerMm;
    const cxLocal = (pMinX + pMaxX) / 2;
    const cyLocal = (pMinY + pMaxY) / 2;
    const bx = fp.x + cxLocal * Math.cos(rad) - cyLocal * Math.sin(rad);
    const by = fp.y + cxLocal * Math.sin(rad) + cyLocal * Math.cos(rad);
    ctx.save();
    ctx.translate(tx(bx), ty(by));
    ctx.rotate(side === 'top' ? rad : -rad);
    ctx.shadowColor = 'rgba(0,0,0,0.48)';
    ctx.shadowBlur = Math.max(6, 0.7 * pxPerMm);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-w * 0.48, -h * 0.48, w * 0.96, h * 0.96);
    ctx.restore();
  }

  // 3. Vias
  for (const v of board.vias) {
    const vx = tx(v.x), vy = ty(v.y);
    const rOut = (v.size / 2) * pxPerMm;
    const rIn = (v.drill / 2) * pxPerMm;
    ctx.fillStyle = '#e5c14d'; ctx.beginPath(); ctx.arc(vx, vy, rOut, 0, Math.PI * 2); ctx.fill();
    mctx.fillStyle = '#f5f5f5'; mctx.beginPath(); ctx.arc(vx, vy, rOut, 0, Math.PI * 2); mctx.fill();
    rctx.fillStyle = '#242424'; rctx.beginPath(); ctx.arc(vx, vy, rOut, 0, Math.PI * 2); rctx.fill();
    bctx.fillStyle = '#dcdcdc'; bctx.beginPath(); ctx.arc(vx, vy, rOut, 0, Math.PI * 2); bctx.fill();

    ctx.fillStyle = '#07090b'; ctx.beginPath(); ctx.arc(vx, vy, rIn, 0, Math.PI * 2); ctx.fill();
    mctx.fillStyle = '#000000'; mctx.beginPath(); ctx.arc(vx, vy, rIn, 0, Math.PI * 2); mctx.fill();
    bctx.fillStyle = '#080808'; bctx.beginPath(); ctx.arc(vx, vy, rIn, 0, Math.PI * 2); bctx.fill();
  }

  // 4. Footprint Pads (ENIG Gold) + Silkscreen
  for (const fp of board.footprints) {
    const rad = (-fp.rot * Math.PI) / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    const toBoard = (lx: number, ly: number): [number, number] => [fp.x + lx * cos - ly * sin, fp.y + lx * sin + ly * cos];

    if (fp.side === side) {
      ctx.strokeStyle = '#f5f7fa';
      rctx.strokeStyle = '#d4d4d4';
      bctx.strokeStyle = '#929292';
      const sw = Math.max(1.2, 0.16 * pxPerMm);
      for (const target of [ctx, rctx, bctx]) {
        target.lineWidth = sw;
        for (const [x1, y1, x2, y2] of fp.silkLines) {
          const [bx1, by1] = toBoard(x1, y1);
          const [bx2, by2] = toBoard(x2, y2);
          target.beginPath(); target.moveTo(tx(bx1), ty(by1)); target.lineTo(tx(bx2), ty(by2)); target.stroke();
        }
        for (const [x1, y1, x2, y2] of fp.silkRects) {
          const pts = [toBoard(x1, y1), toBoard(x2, y1), toBoard(x2, y2), toBoard(x1, y2)];
          target.beginPath();
          target.moveTo(tx(pts[0][0]), ty(pts[0][1]));
          for (let k = 1; k < 4; k++) target.lineTo(tx(pts[k][0]), ty(pts[k][1]));
          target.closePath(); target.stroke();
        }
      }
      if (fp.ref && !fp.lib.toLowerCase().includes('mountinghole')) {
        const [rx, ry] = fp.refAt ? toBoard(fp.refAt[0], fp.refAt[1]) : [fp.x, fp.y - 2.4];
        const fontPx = Math.max(9, Math.round(0.82 * pxPerMm));
        ctx.fillStyle = '#f5f7fa';
        ctx.font = `700 ${fontPx}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fp.ref, tx(rx), ty(ry));
      }
    }

    for (const p of fp.pads) {
      const onThisSide = p.layers.some((l) => l === '*.Cu' || (side === 'top' ? l === 'F.Cu' : l === 'B.Cu'));
      if (!onThisSide) continue;
      const [bx, by] = toBoard(p.x, p.y);
      const px = tx(bx), py = ty(by);
      const pw = p.w * pxPerMm, ph = p.h * pxPerMm;

      const drawPad = (target: CanvasRenderingContext2D, fill: string) => {
        target.save();
        target.translate(px, py);
        target.rotate(side === 'top' ? rad : -rad);
        target.fillStyle = fill;
        if (p.shape === 'circle' || p.shape === 'oval') {
          target.beginPath();
          target.ellipse(0, 0, pw / 2, ph / 2, 0, 0, Math.PI * 2);
          target.fill();
        } else {
          const r = p.shape === 'roundrect' ? Math.min(pw, ph) * 0.22 : 0;
          target.beginPath();
          target.roundRect(-pw / 2, -ph / 2, pw, ph, r);
          target.fill();
        }
        target.restore();
      };

      if (p.type !== 'np_thru_hole') {
        drawPad(ctx, '#e8c44f');
        drawPad(mctx, '#f8f8f8');
        drawPad(rctx, '#202020');
        drawPad(bctx, '#e2e2e2');
      }
      if (p.drill > 0) {
        const rIn = (p.drill / 2) * pxPerMm;
        ctx.fillStyle = '#07090b'; ctx.beginPath(); ctx.arc(px, py, rIn, 0, Math.PI * 2); ctx.fill();
        mctx.fillStyle = '#000000'; mctx.beginPath(); ctx.arc(px, py, rIn, 0, Math.PI * 2); mctx.fill();
        bctx.fillStyle = '#000000'; bctx.beginPath(); ctx.arc(px, py, rIn, 0, Math.PI * 2); bctx.fill();
      }
    }
  }

  // 5. Board silkscreen texts
  ctx.fillStyle = '#f6f8fa';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of board.texts) {
    if (t.side !== side) continue;
    ctx.font = `700 ${Math.max(11, Math.round(t.size * pxPerMm))}px sans-serif`;
    ctx.fillText(t.text, tx(t.x), ty(t.y));
  }

  const wrap = (c: HTMLCanvasElement, srgb = false) => {
    const tex = new THREE.CanvasTexture(c);
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  };
  return {
    colorTex: wrap(colorCanvas, true),
    metalTex: wrap(metalCanvas),
    roughTex: wrap(roughCanvas),
    bumpTex: wrap(bumpCanvas),
  };
}

/** Entegre üstü lazer baskı dokusu (ör. RP2040 / W25Q128) */
function makeIcTopTexture(ref: string, value: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#191b1f';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = 'rgba(255,255,255,0.032)';
  for (let i = 0; i < 900; i++) ctx.fillRect((i * 73) % 256, (i * 137) % 256, 2, 2);

  // Pin 1 recessed laser dimple
  const grad = ctx.createRadialGradient(42, 214, 2, 42, 214, 15);
  grad.addColorStop(0, '#c8ced8');
  grad.addColorStop(1, '#2a2e35');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(42, 214, 14, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#a4acb8';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '700 32px monospace';
  ctx.fillText((value || ref || 'IC').slice(0, 10), 128, 112);
  ctx.fillStyle = '#6f7784';
  ctx.font = '600 18px monospace';
  ctx.fillText('KL-2648', 128, 150);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** SMD direnç üstü mikro kod baskısı (103, 331, 472...) */
function makeResistorCodeTexture(code: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#121418';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#d8dee6';
  ctx.font = '700 32px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(code, 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Yumuşak stüdyo düşme gölgesi (kartın altında) */
function makeDropShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 240);
  g.addColorStop(0, 'rgba(6, 12, 20, 0.52)');
  g.addColorStop(0.55, 'rgba(6, 12, 20, 0.22)');
  g.addColorStop(1, 'rgba(6, 12, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(c);
}

/** Yuvarlatılmış dikdörtgen / stadyum profili */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  const cr = Math.min(r, w / 2, h / 2);
  s.moveTo(x + cr, y);
  s.lineTo(x + w - cr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + cr);
  s.lineTo(x + w, y + h - cr);
  s.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
  s.lineTo(x + cr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - cr);
  s.lineTo(x, y + cr);
  s.quadraticCurveTo(x, y, x + cr, y);
  return s;
}

/** Gerçek S-kıvrımlı gull-wing IC bacağı (X: dıştan gövdeye, Z: yukarı) */
function createGullWingLeadGeo(leadLen: number, leadWidth: number, height: number): THREE.ExtrudeGeometry {
  const t = 0.14;
  const s = new THREE.Shape();
  // Foot resting flat on pad (0 -> 0.42*len), rising curve to body (0.65*len -> len)
  const f = leadLen * 0.45;
  const k = leadLen * 0.72;
  s.moveTo(0, 0);
  s.lineTo(f, 0);
  s.quadraticCurveTo(k, 0, k, height * 0.45);
  s.quadraticCurveTo(k, height, leadLen, height);
  s.lineTo(leadLen, height + t);
  s.quadraticCurveTo(k - t, height + t, k - t, height * 0.45);
  s.quadraticCurveTo(k - t, t, f - t * 0.5, t);
  s.lineTo(0, t);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, { depth: leadWidth, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -leadWidth / 2);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/* ---------------- Detailed Procedural 3D Components ---------------- */

function createComponent3D(
  fp: ParsedFootprint,
  mats: {
    icBlack: THREE.Material;
    metalSilver: THREE.Material;
    solderTin: THREE.Material;
    brushedSteel: THREE.Material;
    gold: THREE.Material;
    ceramicBrown: THREE.Material;
    resistorDark: THREE.Material;
    resistorCodeMat: THREE.Material;
    plasticDark: THREE.Material;
    buttonCap: THREE.Material;
    ledGreen: THREE.Material;
    ledAmber: THREE.Material;
    crystalLid: THREE.Material;
    terminalBlue: THREE.Material;
    pin1Dot: THREE.Material;
  },
  extraDisposables: { dispose: () => void }[]
): THREE.Group | null {
  const id = `${fp.lib} ${fp.ref} ${fp.value}`.toLowerCase();
  if (id.includes('mountinghole')) return null;

  const g = new THREE.Group();
  g.userData = { ref: fp.ref || '—', value: fp.value || '', lib: fp.lib };

  let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
  for (const p of fp.pads) {
    pMinX = Math.min(pMinX, p.x - p.w / 2); pMaxX = Math.max(pMaxX, p.x + p.w / 2);
    pMinY = Math.min(pMinY, p.y - p.h / 2); pMaxY = Math.max(pMaxY, p.y + p.h / 2);
  }
  const spanX = Number.isFinite(pMinX) ? Math.max(1.5, pMaxX - pMinX) : 3;
  const spanY = Number.isFinite(pMinY) ? Math.max(1.5, pMaxY - pMinY) : 3;
  const midX = Number.isFinite(pMinX) ? (pMinX + pMaxX) / 2 : 0;
  const midY = Number.isFinite(pMinY) ? (pMinY + pMaxY) / 2 : 0;

  // 1. Realistic USB-C Receptacle
  if (id.includes('usb')) {
    const outer = roundedRectShape(8.94, 3.16, 1.25);
    const hole = roundedRectShape(8.26, 2.48, 0.96);
    outer.holes.push(hole);
    const shellGeo = new THREE.ExtrudeGeometry(outer, { depth: 7.3, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.1, bevelSegments: 4 });
    shellGeo.rotateX(Math.PI / 2);
    const shell = new THREE.Mesh(shellGeo, mats.brushedSteel);
    shell.position.set(midX, midY + 3.65, 1.62);
    g.add(shell);

    const backGeo = new THREE.ExtrudeGeometry(roundedRectShape(8.6, 2.8, 1.0), { depth: 0.5, bevelEnabled: false });
    backGeo.rotateX(Math.PI / 2);
    const backCap = new THREE.Mesh(backGeo, mats.brushedSteel);
    backCap.position.set(midX, midY - 3.2, 1.62);
    g.add(backCap);

    // Dark recessed interior + mid-plate tongue + gold contacts
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(7.9, 5.2, 2.1), mats.plasticDark);
    cavity.position.set(midX, midY + 0.3, 1.62);
    g.add(cavity);
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(6.6, 5.4, 0.62), mats.icBlack);
    tongue.position.set(midX, midY + 1.1, 1.62);
    g.add(tongue);
    // Top stamped interlocking seam + retention tabs
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 6.8, 0.05), mats.plasticDark);
    seam.position.set(midX, midY + 0.1, 3.24);
    g.add(seam);
    for (const dx of [-2.1, 2.1]) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.45, 0.1), mats.metalSilver);
      tab.position.set(midX + dx, midY + 0.5, 3.26);
      g.add(tab);
    }
    for (const p of fp.pads) {
      if (p.type !== 'smd') continue;
      const pin = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.82, p.h * 0.92, 0.36), mats.gold);
      pin.position.set(p.x, p.y, 0.18);
      g.add(pin);
    }
    return g;
  }

  // 2. Tactile Push Button
  if (id.includes('button') || id.includes('switch') || fp.ref.toUpperCase().startsWith('SW') || id.includes('btn')) {
    const baseGeo = new THREE.ExtrudeGeometry(roundedRectShape(5.8, 5.8, 0.5), { depth: 1.6, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 2 });
    const base = new THREE.Mesh(baseGeo, mats.icBlack);
    base.position.set(midX, midY, 0.1);
    g.add(base);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 5.1, 0.28), mats.brushedSteel);
    bezel.position.set(midX, midY, 1.85);
    g.add(bezel);
    for (const sx of [-2.1, 2.1]) for (const sy of [-2.1, 2.1]) {
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.26, 12), mats.icBlack);
      rivet.rotation.x = Math.PI / 2;
      rivet.position.set(midX + sx, midY + sy, 2.0);
      g.add(rivet);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.82, 1.25, 28), mats.buttonCap);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(midX, midY, 2.55);
    g.add(cap);
    for (const p of fp.pads) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.78, p.h * 0.68, 0.5), mats.solderTin);
      leg.position.set(p.x, p.y, 0.25);
      g.add(leg);
    }
    return g;
  }

  // 3. QFP / QFN / LQFP / MCU IC with true S-curve gull-wing leads
  if (id.includes('qfp') || id.includes('qfn') || id.includes('mcu') || id.includes('stm32') || fp.pads.length >= 20) {
    const bodyW = Math.max(4.5, spanX - 2.3);
    const bodyH = Math.max(4.5, spanY - 2.3);
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(bodyW, bodyH, 0.25), {
      depth: 1.25, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2,
    });
    const body = new THREE.Mesh(bodyGeo, mats.icBlack);
    body.position.set(midX, midY, 0.22);
    g.add(body);

    const topTex = makeIcTopTexture(fp.ref, fp.value);
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.44, metalness: 0.08 });
    extraDisposables.push(topTex, topMat);
    const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(bodyW - 0.35, bodyH - 0.35), topMat);
    labelPlane.position.set(midX, midY, 1.64);
    g.add(labelPlane);

    const leadGeoCache = createGullWingLeadGeo(1.35, 0.32, 0.62);
    extraDisposables.push(leadGeoCache);
    for (const p of fp.pads) {
      const dx = midX - p.x; const dy = midY - p.y;
      const lead = new THREE.Mesh(leadGeoCache, mats.metalSilver);
      if (Math.abs(dx) > Math.abs(dy)) {
        const dir = Math.sign(dx);
        lead.position.set(p.x - dir * 0.45, p.y, 0.04);
        lead.rotation.z = dir > 0 ? 0 : Math.PI;
      } else {
        const dir = Math.sign(dy);
        lead.position.set(p.x, p.y - dir * 0.45, 0.04);
        lead.rotation.z = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      g.add(lead);
    }
    return g;
  }

  // 4. SOIC / TSSOP / Driver / Flash IC with true S-curve gull-wing leads
  if (id.includes('soic') || id.includes('tssop') || id.includes('sop') || (fp.ref.toUpperCase().startsWith('U') && fp.pads.length >= 6)) {
    const bodyW = Math.max(3.6, spanX - 2.1);
    const bodyH = Math.max(4.2, spanY - 0.5);
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(bodyW, bodyH, 0.2), {
      depth: 1.3, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 2,
    });
    const body = new THREE.Mesh(bodyGeo, mats.icBlack);
    body.position.set(midX, midY, 0.22);
    g.add(body);

    const topTex = makeIcTopTexture(fp.ref, fp.value);
    const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.44, metalness: 0.08 });
    extraDisposables.push(topTex, topMat);
    const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(bodyW - 0.3, bodyH - 0.3), topMat);
    labelPlane.position.set(midX, midY, 1.68);
    g.add(labelPlane);

    const leadGeoCache = createGullWingLeadGeo(1.4, 0.44, 0.72);
    extraDisposables.push(leadGeoCache);
    for (const p of fp.pads) {
      const dir = Math.sign(midX - p.x);
      const lead = new THREE.Mesh(leadGeoCache, mats.metalSilver);
      lead.position.set(p.x - dir * 0.5, p.y, 0.04);
      lead.rotation.z = dir > 0 ? 0 : Math.PI;
      g.add(lead);
    }
    return g;
  }

  // 5. SOT-223 / Voltage Regulator
  if (id.includes('sot-223') || id.includes('sot223') || id.includes('reg')) {
    const bodyGeo = new THREE.ExtrudeGeometry(roundedRectShape(6.2, 3.4, 0.2), { depth: 1.4, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
    const body = new THREE.Mesh(bodyGeo, mats.icBlack);
    body.position.set(midX, midY, 0.15);
    g.add(body);
    for (const p of fp.pads) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.78, p.h * 0.8, 0.36), mats.solderTin);
      leg.position.set(p.x, p.y, 0.18);
      g.add(leg);
    }
    return g;
  }

  // 6. Crystal Oscillator
  if (id.includes('crystal') || fp.ref.toUpperCase().startsWith('Y') || id.includes('xtal')) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 0.42), mats.ceramicBrown);
    base.position.set(midX, midY, 0.21);
    g.add(base);
    const lidGeo = new THREE.ExtrudeGeometry(roundedRectShape(2.8, 2.1, 0.25), { depth: 0.38, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    const lid = new THREE.Mesh(lidGeo, mats.crystalLid);
    lid.position.set(midX, midY, 0.42);
    g.add(lid);
    return g;
  }

  // 7. Screw Terminal
  if (id.includes('terminal') || id.includes('klemens')) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(Math.max(6.5, spanX + 2.5), Math.max(6.5, spanY + 2.5), 8.2), mats.terminalBlue);
    block.position.set(midX, midY, 4.1);
    g.add(block);
    for (const p of fp.pads) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.45, 16), mats.brushedSteel);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(p.x, p.y, 8.25);
      g.add(screw);
    }
    return g;
  }

  // 8. Pin Header
  if (id.includes('pinheader') || id.includes('header') || fp.ref.toUpperCase().startsWith('J')) {
    for (const p of fp.pads) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.38, 2.5), mats.plasticDark);
      block.position.set(p.x, p.y, 1.25);
      g.add(block);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.64, 7.6), mats.gold);
      pin.position.set(p.x, p.y, 3.8);
      g.add(pin);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.45, 4), mats.gold);
      tip.rotation.x = Math.PI / 2;
      tip.rotation.y = Math.PI / 4;
      tip.position.set(p.x, p.y, 7.82);
      g.add(tip);
    }
    return g;
  }

  // 9. LED (THT or SMD)
  if (id.includes('led') || fp.ref.toUpperCase().startsWith('D')) {
    const isTht = fp.pads.some((p) => p.type === 'thru_hole');
    const ledMat = id.includes('red') || id.includes('amber') || id.includes('pwr') ? mats.ledAmber : mats.ledGreen;
    if (isTht) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 4.2, 24), ledMat);
      cyl.rotation.x = Math.PI / 2;
      cyl.position.set(midX, midY, 2.5);
      g.add(cyl);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), ledMat);
      dome.rotation.x = Math.PI / 2;
      dome.position.set(midX, midY, 4.6);
      g.add(dome);
    } else {
      const base = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.8, spanX * 0.72), Math.max(1.1, spanY * 0.72), 0.48), mats.pin1Dot);
      base.position.set(midX, midY, 0.24);
      g.add(base);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.1, spanX * 0.44), Math.max(0.9, spanY * 0.58), 0.42), ledMat);
      lens.position.set(midX, midY, 0.66);
      g.add(lens);
    }
    return g;
  }

  // 10. SMD Resistor / Capacitor with solder fillets + resistor micro-code printing
  if (fp.pads.length === 2) {
    const isCap = id.includes('cap') || fp.ref.toUpperCase().startsWith('C');
    const horiz = spanX >= spanY;
    const len = horiz ? spanX * 0.78 : spanY * 0.78;
    const wid = horiz ? Math.max(0.8, spanY * 0.85) : Math.max(0.8, spanX * 0.85);
    const hgt = isCap ? Math.min(1.15, wid * 0.85) : Math.min(0.6, wid * 0.48);

    const bwPart = horiz ? len * 0.66 : wid;
    const bhPart = horiz ? wid : len * 0.66;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(bwPart, bhPart, hgt),
      isCap ? mats.ceramicBrown : [mats.resistorDark, mats.resistorDark, mats.resistorDark, mats.resistorDark, mats.resistorCodeMat, mats.resistorDark]
    );
    body.position.set(midX, midY, hgt / 2 + 0.05);
    g.add(body);

    for (const dir of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len * 0.22 : wid * 1.03, horiz ? wid * 1.03 : len * 0.22, hgt * 1.05),
        mats.metalSilver
      );
      cap.position.set(horiz ? midX + dir * len * 0.4 : midX, horiz ? midY : midY + dir * len * 0.4, hgt / 2 + 0.05);
      g.add(cap);

      // Reflow solder fillet ramp at each end-cap
      const fillet = new THREE.Mesh(
        new THREE.BoxGeometry(horiz ? len * 0.16 : wid * 0.9, horiz ? wid * 0.9 : len * 0.16, hgt * 0.45),
        mats.solderTin
      );
      fillet.position.set(horiz ? midX + dir * len * 0.56 : midX, horiz ? midY : midY + dir * len * 0.56, hgt * 0.22);
      g.add(fillet);
    }
    return g;
  }

  return null;
}

/* ---------------- React Component ---------------- */

export default function Kicad3DView({ url }: Kicad3DViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const compGroupRef = useRef<THREE.Group | null>(null);
  const fitDistRef = useRef(85);

  const [maskColor, setMaskColor] = useState<MaskColorId>('mor');
  const [showComponents, setShowComponents] = useState(true);
  const [xray, setXray] = useState(false);
  const [hovered, setHovered] = useState<{ ref: string; value: string; lib: string } | null>(null);
  const [board, setBoard] = useState<ParsedBoard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    setBoard(null);
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('PCB dosyası indirilemedi.'))))
      .then((text) => { if (!cancelled) setBoard(parseKicadPcb(text)); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'PCB okunamadı.'); });
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (compGroupRef.current) compGroupRef.current.visible = showComponents;
  }, [showComponents]);

  const setView = (preset: 'iso' | 'top' | 'bottom') => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    const d = fitDistRef.current;
    ctrl.target.set(0, 0, 0);
    if (preset === 'top') cam.position.set(0, -0.01, d * 1.15);
    else if (preset === 'bottom') cam.position.set(0, 0.01, -d * 1.15);
    else cam.position.set(d * 0.42, -d * 0.68, d * 0.72);
    cam.lookAt(0, 0, 0);
    ctrl.update();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !board) return;

    let disposed = false;
    let rafId = 0;
    const extraDisposables: { dispose: () => void }[] = [];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const bw = Math.max(5, board.maxX - board.minX);
    const bh = Math.max(5, board.maxY - board.minY);
    const cx = (board.minX + board.maxX) / 2;
    const cy = (board.minY + board.maxY) / 2;
    const diag = Math.hypot(bw, bh);
    fitDistRef.current = diag * 0.88;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.5, diag * 15);
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = diag * 0.2;
    controls.maxDistance = diag * 4;
    controlsRef.current = controls;

    const d = fitDistRef.current;
    camera.position.set(d * 0.42, -d * 0.68, d * 0.72);
    camera.lookAt(0, 0, 0);
    controls.update();

    // Studio 3-point lighting with properly fitted 2048x2048 soft shadow frustum
    scene.add(new THREE.HemisphereLight(0xf2f8ff, 0x1e2c3d, 0.85));
    const sun = new THREE.DirectionalLight(0xfffaf2, 1.45);
    sun.position.set(diag * 0.65, -diag * 0.55, diag * 1.15);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -bw * 0.85;
    sun.shadow.camera.right = bw * 0.85;
    sun.shadow.camera.top = bh * 0.85;
    sun.shadow.camera.bottom = -bh * 0.85;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = diag * 4;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0xd8ecff, 0.85);
    rim.position.set(-diag * 0.75, diag * 0.65, -diag * 0.9);
    scene.add(rim);

    // Floating studio drop-shadow plane beneath the PCB
    const shadowTex = makeDropShadowTexture();
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
    const shadowPlaneGeo = new THREE.PlaneGeometry(bw * 1.45, bh * 1.55);
    extraDisposables.push(shadowTex, shadowMat, shadowPlaneGeo);
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowMat);
    shadowPlane.position.set(0, 0, -board.thickness / 2 - 4.5);
    scene.add(shadowPlane);

    const palette = MASK_PALETTES[maskColor];
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const topMaps = buildBoardMaps(board, 'top', palette, maxAniso);
    const botMaps = buildBoardMaps(board, 'bottom', palette, maxAniso);

    // Real Drilled PCB Substrate
    const boardShape = roundedRectShape(bw, bh, 0.8);
    const addedHoles: { lx: number; ly: number; r: number; plated: boolean }[] = [];
    for (const h of board.holes) {
      const lx = h.x - cx;
      const ly = -(h.y - cy);
      if (Math.abs(lx) + h.r >= bw / 2 - 0.1 || Math.abs(ly) + h.r >= bh / 2 - 0.1) continue;
      if (addedHoles.some((o) => Math.hypot(o.lx - lx, o.ly - ly) < o.r + h.r + 0.05)) continue;
      const hp = new THREE.Path();
      hp.absarc(lx, ly, h.r, 0, Math.PI * 2, true);
      boardShape.holes.push(hp);
      addedHoles.push({ lx, ly, r: h.r, plated: h.plated });
    }

    const boardGeo = new THREE.ExtrudeGeometry(boardShape, { depth: board.thickness, bevelEnabled: false, curveSegments: 16 });
    boardGeo.translate(0, 0, -board.thickness / 2);

    const posAttr = boardGeo.attributes.position;
    const uvAttr = boardGeo.attributes.uv;
    const normAttr = boardGeo.attributes.normal;
    for (let i = 0; i < posAttr.count; i++) {
      const nz = normAttr.getZ(i);
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      if (nz > 0.5) uvAttr.setXY(i, (x + bw / 2) / bw, (y + bh / 2) / bh);
      else if (nz < -0.5) uvAttr.setXY(i, 1 - (x + bw / 2) / bw, (y + bh / 2) / bh);
    }
    uvAttr.needsUpdate = true;

    const edgeMat = new THREE.MeshStandardMaterial({
      color: palette.edge, roughness: 0.72, metalness: 0.06,
      transparent: xray, opacity: xray ? 0.35 : 1,
    });
    // Physical clearcoat solder mask material (realistic glossy lacquer over copper)
    const topMat = new THREE.MeshPhysicalMaterial({
      map: topMaps.colorTex,
      metalnessMap: topMaps.metalTex,
      roughnessMap: topMaps.roughTex,
      bumpMap: topMaps.bumpTex,
      bumpScale: 0.075,
      metalness: 0.92,
      roughness: 0.82,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      transparent: xray,
      opacity: xray ? 0.45 : 1,
    });
    const botMat = new THREE.MeshPhysicalMaterial({
      map: botMaps.colorTex,
      metalnessMap: botMaps.metalTex,
      roughnessMap: botMaps.roughTex,
      bumpMap: botMaps.bumpTex,
      bumpScale: 0.075,
      metalness: 0.92,
      roughness: 0.82,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      transparent: xray,
      opacity: xray ? 0.45 : 1,
    });

    const topIndices: number[] = [];
    const botIndices: number[] = [];
    const sideIndices: number[] = [];
    for (let i = 0; i < posAttr.count; i += 3) {
      const nz = normAttr.getZ(i);
      if (nz > 0.5) topIndices.push(i, i + 1, i + 2);
      else if (nz < -0.5) botIndices.push(i, i + 1, i + 2);
      else sideIndices.push(i, i + 1, i + 2);
    }
    boardGeo.setIndex([...topIndices, ...botIndices, ...sideIndices]);
    boardGeo.clearGroups();
    boardGeo.addGroup(0, topIndices.length, 0);
    boardGeo.addGroup(topIndices.length, botIndices.length, 1);
    boardGeo.addGroup(topIndices.length + botIndices.length, sideIndices.length, 2);

    const boardMesh = new THREE.Mesh(boardGeo, [topMat, botMat, edgeMat]);
    boardMesh.receiveShadow = true;
    boardMesh.castShadow = true;
    scene.add(boardMesh);

    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xe6c14a, roughness: 0.22, metalness: 0.94, side: THREE.DoubleSide });
    extraDisposables.push(barrelMat);
    const barrelGroup = new THREE.Group();
    for (const h of addedHoles) {
      if (!h.plated) continue;
      const bGeo = new THREE.CylinderGeometry(h.r * 0.98, h.r * 0.98, board.thickness + 0.02, 16, 1, true);
      bGeo.rotateX(Math.PI / 2);
      const barrel = new THREE.Mesh(bGeo, barrelMat);
      barrel.position.set(h.lx, h.ly, 0);
      barrelGroup.add(barrel);
    }
    scene.add(barrelGroup);

    const resCodeTex = makeResistorCodeTexture('103');
    extraDisposables.push(resCodeTex);

    const compMats = {
      icBlack:         new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.42, metalness: 0.06 }),
      metalSilver:     new THREE.MeshStandardMaterial({ color: 0xe0e5eb, roughness: 0.16, metalness: 0.96 }),
      solderTin:       new THREE.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.22, metalness: 0.94 }),
      brushedSteel:    new THREE.MeshStandardMaterial({ color: 0xc2cad3, roughness: 0.24, metalness: 0.94 }),
      gold:            new THREE.MeshStandardMaterial({ color: 0xebc44f, roughness: 0.18, metalness: 0.96 }),
      ceramicBrown:    new THREE.MeshPhysicalMaterial({ color: 0x9e6a3f, roughness: 0.25, metalness: 0.05, clearcoat: 0.65, clearcoatRoughness: 0.2 }),
      resistorDark:    new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.32, metalness: 0.1 }),
      resistorCodeMat: new THREE.MeshStandardMaterial({ map: resCodeTex, roughness: 0.34, metalness: 0.08 }),
      plasticDark:     new THREE.MeshStandardMaterial({ color: 0x1e2126, roughness: 0.54, metalness: 0.04 }),
      buttonCap:       new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.44, metalness: 0.05 }),
      ledGreen:        new THREE.MeshPhysicalMaterial({ color: 0x39ff6a, emissive: 0x126b28, roughness: 0.12, metalness: 0.02, clearcoat: 0.9, transparent: true, opacity: 0.9 }),
      ledAmber:        new THREE.MeshPhysicalMaterial({ color: 0xffb830, emissive: 0x7a4200, roughness: 0.12, metalness: 0.02, clearcoat: 0.9, transparent: true, opacity: 0.9 }),
      crystalLid:      new THREE.MeshStandardMaterial({ color: 0xdccfb6, roughness: 0.22, metalness: 0.84 }),
      terminalBlue:    new THREE.MeshStandardMaterial({ color: 0x1f5ca8, roughness: 0.44, metalness: 0.05 }),
      pin1Dot:         new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.48, metalness: 0.05 }),
    };

    const compGroup = new THREE.Group();
    compGroup.visible = showComponents;
    compGroupRef.current = compGroup;

    for (const fp of board.footprints) {
      const comp = createComponent3D(fp, compMats, extraDisposables);
      if (!comp) continue;
      comp.position.set(fp.x - cx, -(fp.y - cy), fp.side === 'top' ? board.thickness / 2 : -board.thickness / 2);
      comp.rotation.z = (fp.rot * Math.PI) / 180;
      if (fp.side === 'bottom') comp.rotation.x = Math.PI;
      comp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.receiveShadow = true; }
      });
      compGroup.add(comp);
    }
    scene.add(compGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onPointerMove = (e: PointerEvent) => {
      if (!compGroup.visible) { setHovered(null); return; }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(compGroup.children, true);
      if (hits.length === 0) { setHovered(null); return; }
      let cur: THREE.Object3D | null = hits[0].object;
      while (cur && cur.parent !== compGroup) cur = cur.parent;
      if (cur?.userData?.ref) {
        setHovered(cur.userData as { ref: string; value: string; lib: string });
      }
    };
    const onPointerLeave = () => setHovered(null);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const tick = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(tick);
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      boardGeo.dispose();
      edgeMat.dispose(); topMat.dispose(); botMat.dispose();
      topMaps.colorTex.dispose(); topMaps.metalTex.dispose(); topMaps.roughTex.dispose(); topMaps.bumpTex.dispose();
      botMaps.colorTex.dispose(); botMaps.metalTex.dispose(); botMaps.roughTex.dispose(); botMaps.bumpTex.dispose();
      Object.values(compMats).forEach((m) => m.dispose());
      extraDisposables.forEach((dObj) => dObj.dispose());
      barrelGroup.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
      compGroup.traverse((obj) => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [board, maskColor, xray]);

  if (error) return <p className="p-6 text-sm text-hata">{error}</p>;

  return (
    <div className="relative w-full h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #b8d0dc 0%, #5b758c 55%, #1d2c3f 100%)' }}>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-levha/85 backdrop-blur border-b border-levha-cizgi text-xs">
        <button type="button" onClick={() => setView('iso')} className="h-7 px-2.5 rounded bg-levha-yuzey hover:text-isaret text-tebesir transition-colors">
          İzometrik
        </button>
        <button type="button" onClick={() => setView('top')} className="h-7 px-2.5 rounded hover:bg-levha-yuzey text-tebesir-soluk hover:text-tebesir transition-colors">
          Üst
        </button>
        <button type="button" onClick={() => setView('bottom')} className="h-7 px-2.5 rounded hover:bg-levha-yuzey text-tebesir-soluk hover:text-tebesir transition-colors">
          Alt
        </button>
        <button type="button" onClick={() => setView('iso')} className="p-1.5 rounded hover:bg-levha-yuzey text-tebesir-silik hover:text-tebesir" title="Kamerayı sıfırla" aria-label="Kamerayı sıfırla">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <span className="h-4 w-px bg-levha-cizgi mx-1" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setShowComponents((v) => !v)}
          aria-pressed={showComponents}
          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded transition-colors ${showComponents ? 'bg-levha-yuzey text-isaret' : 'text-tebesir-silik hover:text-tebesir'}`}
        >
          <Box className="w-3.5 h-3.5" aria-hidden="true" />
          Parçalar
        </button>
        <button
          type="button"
          onClick={() => setXray((v) => !v)}
          aria-pressed={xray}
          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded transition-colors ${xray ? 'bg-levha-yuzey text-isaret' : 'text-tebesir-silik hover:text-tebesir'}`}
        >
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
          X-Ray
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-tebesir-silik hidden sm:inline">Maske:</span>
          {(Object.entries(MASK_PALETTES) as [MaskColorId, (typeof MASK_PALETTES)[MaskColorId]][]).map(([id, p]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMaskColor(id)}
              aria-label={`Lehim maskesi: ${p.label}`}
              title={p.label}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${maskColor === id ? 'border-isaret scale-110' : 'border-white/30 hover:scale-105'}`}
              style={{ backgroundColor: p.swatch }}
            />
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={hostRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        {!board && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-tebesir" />
          </div>
        )}
        {hovered && (
          <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-levha/90 border border-levha-cizgi px-3 py-2 text-xs shadow-lg backdrop-blur">
            <p className="font-mono font-semibold text-isaret">
              {hovered.ref}{hovered.value ? ` · ${hovered.value}` : ''}
            </p>
            <p className="text-tebesir-silik truncate max-w-[260px]">{hovered.lib}</p>
          </div>
        )}
        {board && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-levha/80 border border-levha-cizgi px-3 py-1 text-xs text-tebesir-soluk backdrop-blur">
            Sürükle: 360° döndür · Sağ tık: kaydır · Tekerlek: yakınlaştır · {board.footprints.length} parça
          </p>
        )}
      </div>
    </div>
  );
}
