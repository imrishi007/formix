/*
 * scripts/rasterize-mark.mjs
 * Hand-written favicon/apple-touch/OG asset generator for the Formix brand
 * mark (NO ImageMagick, NO sharp, NO canvas — deliberately dependency-free).
 *
 * The mark is the `< | >` bracket/pipe pair from components/brand/formix-logo.tsx
 * (THE single source of truth for the geometry; coordinates are duplicated
 * below because build tooling can't import .tsx). Because the mark is purely
 * straight line strokes with round caps, rasterization reduces to drawing a
 * few "capsule" segments: for each pixel we measure the distance to the
 * nearest segment and derive anti-aliased coverage from it.
 *
 * Outputs (written into public/):
 *   - formix.svg         512×512 mark on transparent, accent blue (light)
 *   - icon-light.png     32×32  light tile + blue-500 mark  (favicon, light)
 *   - icon-dark.png      32×32  navy tile   + blue-400 mark  (favicon, dark)
 *   - apple-icon.png     180×180 navy square + blue-400 mark (iOS touch icon)
 *
 * Colors are computed from design.md v3 tokens:
 *   --blue-500 = oklch(58% 0.16 260)   ≈ #3D77D7  (light-theme accent)
 *   accent (dark) = #5B8DEF (design.md dark theme, exact hex)
 *   bg-base (dark) = #0A0E17 (design.md dark theme, exact hex)
 *   --neutral-50 = oklch(98.5% 0.004 90) ≈ #FBFAF7 (light page bg)
 */

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

/* ── Brand geometry (mirrors formix-logo.tsx, viewBox 0 0 28 28) ───────── */
const SEGMENTS = [
  // Left bracket arm `<` : two segments meeting at a sharp join (round join
  // is emulated by the round cap on each segment covering the corner).
  { x1: 11, y1: 6, x2: 4, y2: 14, r: 1.2 },
  { x1: 4, y1: 14, x2: 11, y2: 22, r: 1.2 },
  // Right bracket arm `>`:
  { x1: 17, y1: 6, x2: 24, y2: 14, r: 1.2 },
  { x1: 24, y1: 14, x2: 17, y2: 22, r: 1.2 },
  // Center pipe — the rendered "field":
  { x1: 14, y1: 9.5, x2: 14, y2: 18.5, r: 1.1 },
];

// Bounding box of the mark in viewBox units (used for centering on a tile).
const MARK_BBOX = { x: 4, y: 6, w: 20, h: 16 };

/* ── Colors (hex, from design.md tokens — see header) ─────────────────── */
const C = {
  lightTile: "#FBFAF7",
  lightMark: "#3D77D7",
  darkTile: "#0A0E17",
  darkMark: "#5B8DEF",
};

/* ── Tiny PNG encoder (8-bit RGBA, color type 6) ──────────────────────── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // Scanlines: filter byte 0 + RGBA. Deflate compresses the whole image.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // no per-row filtering
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/* ── Mark coverage: anti-aliased "capsule" stroke distance field ──────── */
// Returns coverage in [0,1] at pixel center (px, py) in "mark space" units
// where the 28×28 viewBox maps onto a box of the given size.
function markCoverage(px, py, scale, originX, originY) {
  let best = Infinity;
  for (const s of SEGMENTS) {
    // Closest point on segment a→b to the sample pixel p:
    //   t = dot(p - a, d) / |d|²  clamped to [0,1], then point = a + t·d.
    const ax = px - (s.x1 * scale + originX);
    const ay = py - (s.y1 * scale + originY);
    const dx = (s.x2 - s.x1) * scale;
    const dy = (s.y2 - s.y1) * scale;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : (ax * dx + ay * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = px - (s.x1 * scale + originX) - t * dx;
    const cy = py - (s.y1 * scale + originY) - t * dy;
    // Signed distance: negative inside the stroke capsule.
    const d = Math.hypot(cx, cy) - s.r * scale;
    if (d < best) best = d;
  }
  // Coverage: distance < -0.5 → fully covered; > 0.5 → fully outside.
  return Math.max(0, Math.min(1, 0.5 - best));
}

/* ── Rounded-rect tile coverage (signed distance to rounded box) ──────── */
function roundedRectCoverage(px, py, size, radius) {
  const half = size / 2;
  const qx = Math.abs(px - half) - (half - radius);
  const qy = Math.abs(py - half) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return Math.max(0, Math.min(1, 0.5 - (outside + inside)));
}

/* ── Render one favicon tile ──────────────────────────────────────────── */
// tileColor: background; markColor: stroke; markPadding: inset around the
// mark bbox; radius: corner radius (pass size/2 for a full-bleed square);
// ss: supersampling factor (coverage is averaged over ss×ss subpixels).
function renderTile(size, tileColor, markColor, markPadding, radius, ss = 4) {
  const [tr, tg, tb] = hexToRgb(tileColor);
  const [mr, mg, mb] = hexToRgb(markColor);
  const sub = ss * ss;
  // Scale the 28×28 viewBox so the mark's 20×16 bbox fits the padded area.
  // The mark is centered inside the 28×28 box (both bbox centers are 14), so
  // a single centered origin covers every axis.
  const avail = size - 2 * markPadding;
  const scale = Math.min(avail / MARK_BBOX.w, avail / MARK_BBOX.h);
  const full = 28 * scale;
  const origin = (size - full) / 2;

  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tileSum = 0;
      let markSum = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const tc = roundedRectCoverage(px, py, size, radius);
          tileSum += tc;
          markSum += tc * markCoverage(px, py, scale, origin, origin);
        }
      }
      const tileA = tileSum / sub;
      const markA = markSum / sub;
      // Final color = mark where covered, else tile; alpha = tile coverage
      // (the mark never extends past the tile because both are clipped).
      const mix = markA / (tileA || 1);
      const i = (y * size + x) * 4;
      rgba[i] = Math.round(tr + (mr - tr) * mix);
      rgba[i + 1] = Math.round(tg + (mg - tg) * mix);
      rgba[i + 2] = Math.round(tb + (mb - tb) * mix);
      rgba[i + 3] = Math.round(tileA * 255);
    }
  }
  return rgba;
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/* ── public/formix.svg (512×512, transparent, accent blue) ────────────── */
function formixSvg() {
  const s = 512 / 28; // scale from the 28×28 viewBox
  const r2 = (n) => Math.round(n * 100) / 100;
  const parts = SEGMENTS.map(
    (seg) =>
      `<path d="M${r2(seg.x1 * s)} ${r2(seg.y1 * s)} L${r2(seg.x2 * s)} ${r2(seg.y2 * s)}" stroke="#3D77D7" stroke-width="${r2(seg.r * 2 * s)}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  ).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none" role="img" aria-label="Formix">
  <!-- Formix mark (geometry from components/brand/formix-logo.tsx), accent blue. -->
  ${parts}
</svg>
`;
}

mkdirSync(PUBLIC, { recursive: true });
writeFileSync(join(PUBLIC, "formix.svg"), formixSvg());

const outputs = [
  { file: "icon-light.png", size: 32, tile: C.lightTile, mark: C.lightMark, pad: 6, radius: 5, ss: 4 },
  { file: "icon-dark.png", size: 32, tile: C.darkTile, mark: C.darkMark, pad: 6, radius: 5, ss: 4 },
  { file: "apple-icon.png", size: 180, tile: C.darkTile, mark: C.darkMark, pad: 36, radius: 0, ss: 4 },
];

for (const o of outputs) {
  const rgba = renderTile(o.size, o.tile, o.mark, o.pad, o.radius, o.ss);
  writeFileSync(join(PUBLIC, o.file), encodePNG(o.size, o.size, rgba));
  console.log(`wrote public/${o.file} (${o.size}×${o.size})`);
}
console.log("wrote public/formix.svg (512×512)");
