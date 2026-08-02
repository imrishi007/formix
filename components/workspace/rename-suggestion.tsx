"use client";

/**
 * components/workspace/rename-suggestion.tsx
 *
 * Non-intrusive banner shown when the form's `form "Title"` declaration in
 * the DSL no longer matches the form's stored title. Purely a suggestion —
 * renaming only ever happens when the author clicks "Rename". Floats above
 * the workspace panels (absolute positioning) so its appearance/disappearance
 * never shifts panel layout or triggers a resize.
 */

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RenameSuggestion({
  detectedTitle,
  onRename,
  onKeepCurrent,
}: {
  detectedTitle: string | null;
  onRename: () => void;
  onKeepCurrent: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-30 flex justify-center px-4">
      <AnimatePresence>
        {detectedTitle && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass-card pointer-events-auto flex max-w-lg items-center gap-3 rounded-full py-2 pl-4 pr-2"
          >
            <Sparkles className="h-3.5 w-3.5 flex-none text-(--accent-primary)" />
            <p className="min-w-0 flex-1 truncate text-xs text-(--ink-primary)/90">
              This looks like a <strong className="font-semibold text-(--ink-primary)">{detectedTitle}</strong> form. Rename project?
            </p>
            <div className="flex flex-none items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={onKeepCurrent}>
                Keep Current
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs" onClick={onRename}>
                Rename
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
