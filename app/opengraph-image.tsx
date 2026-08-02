import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*
 * app/opengraph-image.tsx
 * Social-share OG image (1200×630) for Formix, generated at build time via
 * next/og (satori). Mirrors the design.md v3 dark theme: bg-base #0A0E17
 * field with a blue radial hue-wash top-left, the shared `< | >` brand mark,
 * and the Formix wordmark in the real Geist typeface (loaded from
 * node_modules — no network fetch, so the build works offline).
 *
 * Colors are design.md v3 exact hexes:
 *   bg-base  #0A0E17   (dark app background)
 *   accent   #5B8DEF   (dark-theme accent)
 *   hover    #4A7CE0   (accent hover)
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Formix — Define forms in code, render them as live UIs";

const NAVY_950 = "#0A0E17";
const BLUE_400 = "#5B8DEF";
const BLUE_300 = "#4A7CE0";
const WHITE = "#FFFFFF";

/*
 * The brand mark geometry, mirrored from components/brand/formix-logo.tsx
 * (that component is THE source of truth — this copy exists only because
 * build-time image routes can't import client components).
 */
function BrandMark({ size: px }: { size: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 28 28" fill="none">
      <path
        d="M11 6 L4 14 L11 22"
        stroke={BLUE_400}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17 6 L24 14 L17 22"
        stroke={BLUE_400}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1={14}
        y1={9.5}
        x2={14}
        y2={18.5}
        stroke={BLUE_400}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default async function OpenGraphImage() {
  const [semiBold, regular] = await Promise.all([
    readFile(path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf")),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: NAVY_950,
        color: WHITE,
        position: "relative",
        fontFamily: "Geist",
      }}
    >
      {/* Blue hue wash, top-left, mirroring .bg-hue-wash in app/globals.css */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 60% at 0% 0%, rgba(91,141,239,0.28) 0%, rgba(10,14,23,0) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 120,
          bottom: 90,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: 0.55,
        }}
      >
        <BrandMark size={44} />
        <div style={{ fontSize: 26, color: BLUE_300, fontFamily: "Geist", fontWeight: 600 }}>
          .forml
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <BrandMark size={132} />
        <div
          style={{
            marginTop: 48,
            fontSize: 96,
            fontWeight: 600,
            letterSpacing: -2,
            color: WHITE,
          }}
        >
          Formix
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 34,
            color: BLUE_300,
            letterSpacing: -0.3,
          }}
        >
          Define forms in code, render them as live UIs.
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Geist", data: semiBold, weight: 600, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
