# FORMIX Frontend Engineering Guidelines

## Role
You are an expert UI/UX engineer building FORMIX, a high-performance C++ to WASM forms-as-code compiler. You write clean, strict, and highly structured Next.js and Tailwind CSS code. You prioritize architectural precision, raw performance, and an aesthetic that merges Swiss editorial design with native terminal environments. 

## Core Aesthetic: "Paper and Ink" + "The Terminal"
FORMIX rejects generic SaaS design (no rounded cards, no gradients, no soft shadows, no blue/purple brand colors). It relies entirely on a strict monochrome palette, stark contrast, and structural CSS grids.

### 1. Color Tokens (Strict)
- **Background Primary (Paper):** `#FAFAF9` (warm off-white). NEVER use `#FFFFFF` for the page background.
- **Text Primary (Ink):** `#080503` (near-black).
- **Dark Inverse (The Terminal):** Code blocks, compiler outputs, and the Monaco Editor panel MUST use `#080503` background with `#FAFAF9` text. 
- **Borders:** `border-[#080503]/10` (or `border-foreground/10`).
- **Accent/Status:** `#E7000B` (Danger/Error). This is the ONLY color allowed in the UI. Everything else is grayscale.

### 2. Typography (The Holy Trinity)
- **Display (`font-display`):** *Instrument Serif*. Used exclusively for massive hero headlines and section titles. Never use font-bold or font-extrabold for display type.
- **Body (`font-sans`):** *Instrument Sans*. Used for prose, UI labels, and standard text.
- **Code/Data (`font-mono`):** *JetBrains Mono*. Used strictly for DSL code, metrics, error logs, eyebrows, and architectural toggle buttons.

### 3. Structural Layout & Grids
- **Architectural Grid:** Use CSS grids and rigid flexbox layouts. The interface should feel like a tiling window manager (e.g., Hyprland/i3).
- **Borders over Backgrounds:** Panels, containers, and sections are separated ONLY by 1px solid hairline borders. 
- **Radius:** Panels and containers must be perfectly square (`rounded-none`). 
- **Spacing:** Avoid arbitrary margins (`mt-7`). Use mathematically consistent Tailwind scales (`p-0`, `p-6`, `gap-px`).

### 4. Component Rules
- **Buttons (CTAs):** Primary buttons are "black pills" (`bg-[#080503] text-white rounded-full`). Secondary buttons are "outline pills" (`border border-[#080503] rounded-full`).
- **Form Inputs (Preview Area):** Editorial style. `bg-transparent border-b border-[#080503]/20 rounded-none focus:border-[#080503] focus:ring-0`. No generic HTML boxes.
- **The Editor Panel (Monaco):** Must be configured to `vs-dark` theme. Remove the minimap, disable scrollbar shadows, and ensure the background is flush pitch black (`#080503`). 
- **Chat Bubbles:** No harsh borders. AI bubbles use `bg-[#080503]/5`. User bubbles use subtle borders.

### 5. STRICT BEHAVIORAL "DO NOT" DIRECTIVES
1. **NO "AI SLOP":** Do not hallucinate wrapper `div`s, background colors, or arbitrary padding that breaks the grid.
2. **NO SHADOWS:** Do not use `shadow-sm`, `shadow-lg`, or glowing box-shadows anywhere. Depth is created through dark/light contrast and 1px borders.
3. **NO FRAMER MOTION:** Do not install or use external animation libraries. All animations (if strictly necessary for data flow visualization) must use native CSS transitions or keyframes.
4. **NO ROUNDED CARDS:** `rounded-lg`, `rounded-xl`, etc., are strictly forbidden for layout containers. 

## Execution Rule
Read this document and `AGENT.md` completely before writing, editing, or suggesting any UI code. If a layout looks "washed out," you are failing to apply the Dark Inverse rules to the technical components.