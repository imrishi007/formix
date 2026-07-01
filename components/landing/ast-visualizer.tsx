"use client";

import { useEffect, useRef, useState } from "react";

// ─── Static Data ─────────────────────────────────────────────────────────────

const FILE_TREE = [
  { name: "formix", isDir: true, depth: 0 },
  { name: "feedback.forml", isDir: false, depth: 1, active: true },
  { name: "schema.forml", isDir: false, depth: 1, active: false },
  { name: "survey.forml", isDir: false, depth: 1, active: false },
  { name: "grammar", isDir: true, depth: 0 },
  { name: "forml.ebnf", isDir: false, depth: 1, active: false },
];

const DSL_LINES = [
  'form "Customer Feedback" {',
  '  field name : text',
  '    ui {',
  '      label: "Your Name"',
  '      placeholder: "e.g. Jane"',
  "    }",
  "    validate { required }",
  "",
  "  field email : email",
  '    ui { label: "Email" }',
  "    validate { required }",
  "",
  "  field rating : select {",
  '    option "Excellent"',
  '    option "Good"',
  '    option "Poor"',
  "  }",
  "",
  "  action submit {",
  '    endpoint: "/api/submit"',
  "    method: POST",
  "  }",
  "}",
];

const AST_LINES = [
  '{',
  '  "type": "Form",',
  '  "name": "Customer Feedback",',
  '  "body": [',
  '    {',
  '      "type": "Field",',
  '      "name": "name",',
  '      "dataType": "text",',
  '      "ui": {',
  '        "label": "Your Name"',
  '      },',
  '      "validation": {',
  '        "required": true',
  '      }',
  '    },',
  '    {',
  '      "type": "Field",',
  '      "name": "email",',
  '      "dataType": "email"',
  '    },',
  '    {',
  '      "type": "Field",',
  '      "name": "rating",',
  '      "dataType": "select",',
  '      "options": [',
  '        "Excellent",',
  '        "Good",',
  '        "Poor"',
  '      ]',
  '    }',
  '  ]',
  '}',
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function ASTVisualizer() {
  const [revealedDsl, setRevealedDsl] = useState(0);
  const [activeDslLine, setActiveDslLine] = useState(-1);
  const [revealedAst, setRevealedAst] = useState(0);
  const [parseStatus, setParseStatus] = useState<"idle" | "parsing" | "ok">("idle");
  const [cycleCount, setCycleCount] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;

    const run = async () => {
      // Reset
      setRevealedDsl(0);
      setActiveDslLine(-1);
      setRevealedAst(0);
      setParseStatus("idle");

      await delay(600);
      if (cancelled) return;

      // Type DSL lines one by one
      for (let i = 0; i < DSL_LINES.length; i++) {
        if (cancelled) return;
        setActiveDslLine(i);
        setRevealedDsl(i + 1);
        await delay(DSL_LINES[i] === "" ? 60 : 120);
      }

      setActiveDslLine(-1);
      await delay(500);
      if (cancelled) return;

      setParseStatus("parsing");
      await delay(1100);
      if (cancelled) return;

      setParseStatus("ok");
      await delay(300);

      // Reveal AST lines
      for (let i = 1; i <= AST_LINES.length; i++) {
        if (cancelled) return;
        setRevealedAst(i);
        await delay(90);
      }

      await delay(3500);
      if (cancelled) return;
      setCycleCount((c) => c + 1);
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleCount]);

  return (
    // Outer window shell — pitch black, no radius, no shadow
    <div
      className="w-full overflow-hidden"
      style={{
        background: "#080503",
        border: "1px solid rgba(250,250,249,0.08)",
        borderRadius: 0,
        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
      }}
    >
      {/* ── Title Bar ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          padding: "0 14px",
          height: "36px",
          borderBottom: "1px solid rgba(250,250,249,0.08)",
          background: "#0d0b08",
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: "flex", gap: "6px", marginRight: "auto" }}>
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#FF5F57",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#FEBC2E",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#28C840",
              display: "inline-block",
              flexShrink: 0,
            }}
          />
        </div>

        {/* Window title */}
        <span
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            color: "rgba(250,250,249,0.35)",
            letterSpacing: "0.04em",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            userSelect: "none",
          }}
        >
          feedback.forml — Formix Compiler
        </span>

        {/* Parse status badge */}
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            color:
              parseStatus === "ok"
                ? "#05DF72"
                : parseStatus === "parsing"
                ? "rgba(250,250,249,0.45)"
                : "rgba(250,250,249,0.2)",
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background:
                parseStatus === "ok"
                  ? "#05DF72"
                  : parseStatus === "parsing"
                  ? "rgba(250,250,249,0.4)"
                  : "rgba(250,250,249,0.15)",
              display: "inline-block",
              animation:
                parseStatus === "parsing"
                  ? "ast-status-blink 0.6s step-end infinite"
                  : parseStatus === "ok"
                  ? "ast-status-pulse 2s ease-in-out infinite"
                  : "none",
            }}
          />
          {parseStatus === "ok"
            ? "Parse OK"
            : parseStatus === "parsing"
            ? "Compiling…"
            : "Idle"}
        </span>
      </div>

      {/* ── Three-Panel Body ─────────────────────────────────────── */}
      <div style={{ display: "flex", minHeight: "340px", overflow: "hidden" }}>

        {/* LEFT: File Explorer */}
        <div
          style={{
            width: "130px",
            flexShrink: 0,
            borderRight: "1px solid rgba(250,250,249,0.08)",
            padding: "10px 0",
            overflowY: "auto",
          }}
        >
          {/* Explorer header */}
          <div
            style={{
              fontSize: 9,
              color: "rgba(250,250,249,0.28)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0 10px 8px",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            }}
          >
            Explorer
          </div>

          {FILE_TREE.map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: `3px ${item.depth === 1 ? "10px 3px 22px" : "10px 3px 10px"}`,
                fontSize: 10,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                color: item.active
                  ? "#FAFAF9"
                  : item.isDir
                  ? "rgba(250,250,249,0.5)"
                  : "rgba(250,250,249,0.38)",
                background: item.active
                  ? "rgba(250,250,249,0.07)"
                  : "transparent",
                cursor: "default",
                userSelect: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {/* Icon */}
              <span style={{ opacity: 0.6, flexShrink: 0, fontSize: 9 }}>
                {item.isDir ? "▸" : "·"}
              </span>
              <span>{item.name}</span>
            </div>
          ))}
        </div>

        {/* CENTER: Monaco Editor Mockup */}
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            borderRight: "1px solid rgba(250,250,249,0.08)",
            overflowY: "auto",
            padding: "10px 0",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid rgba(250,250,249,0.08)",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                padding: "4px 14px",
                fontSize: 10,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                color: "#FAFAF9",
                borderBottom: "1px solid #FAFAF9",
                marginBottom: "-1px",
                background: "transparent",
                userSelect: "none",
              }}
            >
              feedback.forml
            </div>
            <div
              style={{
                padding: "4px 14px",
                fontSize: 10,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                color: "rgba(250,250,249,0.3)",
                userSelect: "none",
              }}
            >
              schema.forml
            </div>
          </div>

          {/* Code lines */}
          <div style={{ padding: "4px 0" }}>
            {DSL_LINES.map((line, i) => {
              const isRevealed = i < revealedDsl;
              const isActive = i === activeDslLine;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    opacity: isRevealed ? 1 : 0,
                    transition: "opacity 0.12s ease",
                    background: isActive
                      ? "rgba(250,250,249,0.05)"
                      : "transparent",
                    minHeight: "18px",
                  }}
                >
                  {/* Line number */}
                  <span
                    style={{
                      width: "36px",
                      textAlign: "right",
                      paddingRight: "12px",
                      fontSize: 10,
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      color: isActive
                        ? "rgba(250,250,249,0.5)"
                        : "rgba(250,250,249,0.18)",
                      flexShrink: 0,
                      userSelect: "none",
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* Code text — monochrome only, no coloring */}
                  <span
                    style={{
                      fontSize: 10.5,
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      color: isActive
                        ? "#FAFAF9"
                        : "rgba(250,250,249,0.72)",
                      whiteSpace: "pre",
                      letterSpacing: "0.01em",
                      lineHeight: "18px",
                    }}
                  >
                    {line}
                    {/* Blinking cursor on active line */}
                    {isActive && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "2px",
                          height: "12px",
                          background: "#FAFAF9",
                          verticalAlign: "text-bottom",
                          animation: "ast-status-blink 0.8s step-end infinite",
                          marginLeft: "1px",
                        }}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: AST JSON Preview */}
        <div
          style={{
            width: "220px",
            flexShrink: 0,
            overflowY: "auto",
            padding: "10px 0",
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: 9,
              color: "rgba(250,250,249,0.28)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "0 10px 8px",
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              borderBottom: "1px solid rgba(250,250,249,0.06)",
              marginBottom: "8px",
            }}
          >
            AST Output
          </div>

          {/* JSON lines */}
          <div style={{ padding: "0 0 0 0" }}>
            {AST_LINES.map((line, i) => {
              const isRevealed = i < revealedAst;
              const isFresh = i === revealedAst - 1;

              return (
                <div
                  key={i}
                  style={{
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed ? "translateX(0)" : "translateX(6px)",
                    transition: "opacity 0.1s ease, transform 0.1s ease",
                    padding: "1px 10px",
                    background: isFresh
                      ? "rgba(5,223,114,0.05)"
                      : "transparent",
                    minHeight: "16px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      color: isFresh ? "#FAFAF9" : "rgba(250,250,249,0.65)",
                      whiteSpace: "pre",
                      letterSpacing: "0.01em",
                      lineHeight: "16px",
                    }}
                  >
                    {line}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Status Bar ───────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          height: "24px",
          borderTop: "1px solid rgba(250,250,249,0.08)",
          background: "#0a0805",
        }}
      >
        {/* Left side */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              color: "rgba(250,250,249,0.4)",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            WASM – Client Side
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
              color:
                parseStatus === "ok"
                  ? "#05DF72"
                  : "rgba(250,250,249,0.25)",
              letterSpacing: "0.03em",
            }}
          >
            {parseStatus === "ok" ? "✓ Parse OK" : parseStatus === "parsing" ? "⟳ Parsing…" : "— Idle"}
          </span>
        </div>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {["LF", "UTF-8", "main"].map((label) => (
            <span
              key={label}
              style={{
                fontSize: 9.5,
                fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                color: "rgba(250,250,249,0.3)",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
