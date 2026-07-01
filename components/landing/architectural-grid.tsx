// Persistent architectural background grid.
// 5 vertical hairline columns spanning the full viewport height.
// Stays fixed so it tiles consistently across all sections.
// pointer-events-none + z-[-1] ensures zero interference with content.

export function ArchitecturalGrid() {
  // Column positions as percentages — aligned to a 5-column editorial grid
  const columns = [16.66, 33.33, 50, 66.66, 83.33];

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden"
    >
      {/* Vertical hairlines - ink/18 gives clear visibility on #FAFAF9 paper */}
      {columns.map((left) => (
        <div
          key={left}
          className="absolute top-0 bottom-0 w-px"
          style={{ left: `${left}%`, background: "rgba(8,5,3,0.18)" }}
        />
      ))}

      {/* Outer left / right margin rules */}
      <div className="absolute top-0 bottom-0 left-0 w-px" style={{ background: "rgba(8,5,3,0.14)" }} />
      <div className="absolute top-0 bottom-0 right-0 w-px" style={{ background: "rgba(8,5,3,0.14)" }} />
    </div>
  );
}
