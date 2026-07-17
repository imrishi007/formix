"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

// ─── Inline wireframe tetrahedron (replaces deleted animated-tetrahedron.tsx) ──

function TetrahedronDecoration() {
  return (
    <>
      <style>{`
        @keyframes tetra-spin {
          0%   { transform: rotateX(15deg) rotateY(0deg); }
          100% { transform: rotateX(15deg) rotateY(360deg); }
        }
        @keyframes tetra-pulse {
          0%, 100% { opacity: 0.18; }
          50%       { opacity: 0.38; }
        }
        .tetra-scene {
          perspective: 900px;
          width: 320px;
          height: 320px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tetra-solid {
          width: 200px;
          height: 200px;
          transform-style: preserve-3d;
          animation: tetra-spin 12s linear infinite;
        }
        .tetra-face {
          position: absolute;
          width: 0;
          height: 0;
        }
        .tetra-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.12);
          animation: tetra-pulse 4s ease-in-out infinite;
        }
      `}</style>
      <div className="tetra-scene">
        {/* Outer decorative rings */}
        <div className="tetra-ring" style={{ width: 300, height: 300, top: 10, left: 10, animationDelay: "0s" }} />
        <div className="tetra-ring" style={{ width: 240, height: 240, top: 40, left: 40, animationDelay: "1.3s" }} />
        <div className="tetra-ring" style={{ width: 180, height: 180, top: 70, left: 70, animationDelay: "2.6s" }} />

        {/* SVG wireframe tetrahedron projected on 2D, rotated with CSS 3D */}
        <div className="tetra-solid" style={{ position: "absolute" }}>
          <svg
            viewBox="0 0 200 200"
            width="200"
            height="200"
            style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
          >
            {/* Vertices of a regular tetrahedron projected to 2D */}
            {/* A=top, B=bottom-left, C=bottom-right, D=center-back */}
            <g stroke="rgba(255,255,255,0.65)" strokeWidth="1" fill="none">
              {/* Front face edges */}
              <line x1="100" y1="20"  x2="30"  y2="160" strokeWidth="1.5" />
              <line x1="100" y1="20"  x2="170" y2="160" strokeWidth="1.5" />
              <line x1="30"  y1="160" x2="170" y2="160" strokeWidth="1.5" />
              {/* Back edges (dimmed) */}
              <line x1="100" y1="20"  x2="100" y2="120" stroke="rgba(255,255,255,0.25)" strokeDasharray="5 4" />
              <line x1="30"  y1="160" x2="100" y2="120" stroke="rgba(255,255,255,0.25)" strokeDasharray="5 4" />
              <line x1="170" y1="160" x2="100" y2="120" stroke="rgba(255,255,255,0.25)" strokeDasharray="5 4" />
            </g>
            {/* Vertex dots */}
            <g fill="rgba(255,255,255,0.8)">
              <circle cx="100" cy="20"  r="3" />
              <circle cx="30"  cy="160" r="3" />
              <circle cx="170" cy="160" r="3" />
              <circle cx="100" cy="120" r="2.5" fill="rgba(255,255,255,0.4)" />
            </g>
            {/* Edge midpoint markers */}
            <g fill="rgba(255,255,255,0.3)">
              <circle cx="65"  cy="90"  r="1.5" />
              <circle cx="135" cy="90"  r="1.5" />
              <circle cx="100" cy="160" r="1.5" />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground bg-foreground text-background transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
        >
          {/* Spotlight effect */}
          <div 
            className="absolute inset-0 opacity-10 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(250,250,249,0.12), transparent 40%)`
            }}
          />
          
          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-24">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              {/* Left content */}
              <div className="flex-1">
                <h2 className="text-4xl lg:text-7xl font-display tracking-tight mb-8 leading-[0.95] text-background">
                  Your forms deserve
                  <br />
                  to be in Git.
                </h2>

                <p className="text-xl text-background/70 mb-12 leading-relaxed max-w-xl">
                  Stop building forms in drag-and-drop GUIs. Write Forml DSL, version-control it in Git, and let AI generate the hard parts.
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <Button asChild size="lg" className="bg-background hover:bg-background/90 text-foreground px-8 h-14 text-base rounded-full group border border-background">
                    <Link href="/editor/demo">
                      Talk to AI
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="h-14 px-8 text-base rounded-full border-background/20 text-background hover:bg-background/10">
                    <Link href="/editor/demo">Open Editor</Link>
                  </Button>
                </div>

                <p className="text-sm text-background/55 mt-8 font-mono">
                  No drag-and-drop. No JSON configs.
                </p>
              </div>

              {/* Right animation */}
              <div className="hidden lg:flex items-center justify-center w-[500px] h-[500px] -mr-16">
                <TetrahedronDecoration />
              </div>
            </div>
          </div>

          {/* Decorative corner */}
          <div className="absolute top-0 right-0 w-32 h-32 border-b border-l border-background/10" />
          <div className="absolute bottom-0 left-0 w-32 h-32 border-t border-r border-background/10" />
        </div>
      </div>
    </section>
  );
}
