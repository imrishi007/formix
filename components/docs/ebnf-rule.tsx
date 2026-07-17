import { CodeBlock } from "./code-block";

interface EbnfRuleProps {
  name: string;
  definition: string;
  description?: string;
}

export function EbnfRule({ name, definition, description }: EbnfRuleProps) {
  return (
    <div className="my-4 border border-foreground/10 overflow-hidden rounded-sm">
      {/* Rule header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-foreground/[0.02] border-b border-foreground/10">
        <span className="w-2 h-2 rounded-full bg-foreground/20 shrink-0" />
        <code className="text-sm font-mono text-foreground font-medium">{name}</code>
        {description && (
          <span className="text-xs text-muted-foreground ml-auto truncate hidden sm:block">{description}</span>
        )}
      </div>

      {/* EBNF block — no extra margins inside the card */}
      <div className="[&>div]:my-0 [&>div]:border-0 [&>div]:rounded-none">
        <CodeBlock
          code={definition}
          language="ebnf"
          showLineNumbers={false}
          hideHeader={true}
        />
      </div>
    </div>
  );
}
