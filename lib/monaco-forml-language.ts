// lib/monaco-forml-language.ts
//
// FormL language service — completions, snippets, hover docs.
// Register by calling registerFormlLanguageService(monaco) once per Monaco
// instance, typically inside the editor's onMount callback.
//
// Depends on lib/monaco-forml.ts for the keyword / type lists (single source of
// truth). Does NOT import the full monaco-editor package at runtime; it relies
// on the monaco instance passed in by the caller.

import {
  FORML_KEYWORDS,
  FORML_FIELD_TYPES,
  FORML_HTTP_METHODS,
} from "./monaco-forml";

// ── Minimal Monaco provider typing ──────────────────────────────────────────
// We only type what we use so this module never pulls in the heavy
// monaco-editor @types at compile time.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Monaco = any;
type IPosition = { lineNumber: number; column: number };
type IModel = {
  getValueInRange: (range: any) => string;
  getLineContent: (line: number) => string;
  getValue: () => string;
};

// ── Hover docs ───────────────────────────────────────────────────────────────

const HOVER_DOCS: Record<string, string> = {
  // ── Structure ─────────────────────────────────────────────────────────────
  form:    "**`form`** `\"<name>\" { … }`\n\nRoot declaration. Every FormL file must start with exactly one `form` block.",
  field:   "**`field`** `<name> : <type> { … }`\n\nDeclares a single form input. Attach `ui { }`, `validate { }`, and `on <event> { }` sub-blocks.",
  page:    "**`page`** `\"<name>\" { … }`\n\nGroups fields into a logical page. Rendered as a separate step in multi-page flows.",
  section: "**`section`** `\"<name>\" { … }`\n\nVisual grouping inside a page — renders a titled divider above its fields.",
  group:   "**`group`** `<name> { … }`\n\nDefines a named group of fields that can be `use`d or `repeat`ed.",
  use:     "**`use`** `<groupName>`\n\nInlines the fields from a `group` definition at this point.",
  var:     "**`var`** `<name> = <literal>`\n\nDeclares a form-scope constant. Currently limited to number / string literals.",
  repeat:  "**`repeat`** `<groupName> count: <fieldRef>`\n\nDynamically renders copies of a group based on the value of a numeric field.",
  count:   "**`count`**: `<fieldRef>`\n\nInside `repeat` — names the numeric field whose value controls how many copies appear.",
  if:      "**`if`** `(<condition>) { … } else { … }`\n\nConditionally shows or hides a block of fields.",
  else:    "**`else`** `{ … }`\n\nThe branch taken when the `if` condition is false.",
  on:      "**`on`** `<event> { … }`\n\nAttaches a trigger to a field. Supported events: `load`, `change`, `blur`.",

  // ── Field types ───────────────────────────────────────────────────────────
  text:     "**`text`** — Single-line text input. Use `minLength`/`maxLength` for length validation.",
  integer:  "**`integer`** — Integer number input. Use `min`/`max` for range validation.",
  float:    "**`float`** — Decimal number input. Use `min`/`max` for range validation.",
  email:    "**`email`** — Text input with built-in e-mail format validation (`type=\"email\"`).",
  date:     "**`date`** — Date picker rendered as `<input type=\"date\">`.",
  boolean:  "**`boolean`** — Single checkbox, value is `\"true\"` or `\"false\"`.",
  url:      "**`url`** — URL input with built-in format validation.",
  select:   "**`select`** `{ option \"…\" … }`\n\nDropdown selection. List options inside the field block.",
  radio:    "**`radio`** `{ option \"…\" … }`\n\nRadio-button group. List options inside the field block.",
  checkbox: "**`checkbox`** `{ option \"…\" … }`\n\nMulti-select checkboxes. List options inside the field block.",

  // ── UI sub-block keys ─────────────────────────────────────────────────────
  ui:          "**`ui`** `{ … }`\n\nUI annotations block. Supported keys: `label`, `placeholder`, `helpText`.",
  label:       "**`label`**: `\"<text>\"`\n\nThe visible label shown above the field.",
  placeholder: "**`placeholder`**: `\"<text>\"`\n\nGrey hint text shown inside an empty input.",
  helpText:    "**`helpText`**: `\"<text>\"`\n\nSmall helper text shown below the field.",

  // ── Validation rules ──────────────────────────────────────────────────────
  validate:  "**`validate`** `{ … }`\n\nValidation rules block. Supported: `required`, `minLength`, `maxLength`, `pattern`, `min`, `max`.",
  required:  "**`required`**\n\nMakes the field mandatory — the form cannot be submitted when this field is empty.",
  minLength: "**`minLength`**: `<n>`\n\nMinimum number of characters for text fields.",
  maxLength: "**`maxLength`**: `<n>`\n\nMaximum number of characters for text fields.",
  pattern:   "**`pattern`**: `\"<regex>\"`\n\nRegular-expression the value must match.",
  min:       "**`min`**: `<n>`\n\nMinimum numeric value (for `integer` and `float` fields).",
  max:       "**`max`**: `<n>`\n\nMaximum numeric value (for `integer` and `float` fields).",

  // ── Actions ───────────────────────────────────────────────────────────────
  action:   "**`action`** `{ endpoint: \"…\" method: POST }`\n\nForm-level action block — defines where the form data is submitted.",
  submit:   "**`submit`**\n\nTrigger action: submits the form immediately.",
  endpoint: "**`endpoint`**: `\"<url>\"`\n\nThe URL the form `action` POSTs to.",
  method:   "**`method`**: `POST | PUT | PATCH`\n\nHTTP verb for the form action.",
  option:   "**`option`** `\"<value>\"`\n\nAdds a choice to a `select`, `radio`, or `checkbox` field.",

  // ── Compute ───────────────────────────────────────────────────────────────
  compute: "**`compute`** `<name> from <expr>`\n\nDerives a read-only field value from an arithmetic expression over other fields.",
  from:    "**`from`** `<expr>`\n\nThe arithmetic expression that produces the computed value.",

  // ── Layout ───────────────────────────────────────────────────────────────
  row:    "**`row`** `{ … }`\n\nArranges its child fields in a horizontal two-column grid.",
  column: "**`column`** `{ … }`\n\nArranges its child fields vertically (default behaviour).",

  // ── Trigger events ────────────────────────────────────────────────────────
  load:   "**`load`**\n\nFires once when the form is first rendered.",
  change: "**`change`**\n\nFires every time the field value changes.",
  blur:   "**`blur`**\n\nFires when the user leaves the field (focus-out).",

  // ── Trigger actions ───────────────────────────────────────────────────────
  hide:     "**`hide`** `<fieldName>`\n\nHides a field (sets it invisible and clears its value).",
  show:     "**`show`** `<fieldName>`\n\nMakes a previously hidden field visible.",
  clear:    "**`clear`** `<fieldName>`\n\nResets the value of a field to empty.",
  set:      "**`set`** `<fieldName> = <value>`\n\nProgrammatically sets a field's value.",
  navigate: "**`navigate`** `<pageName>`\n\nJumps to a named page in a multi-page form.",

  // ── Misc ─────────────────────────────────────────────────────────────────
  default: "**`default`**: `<value>`\n\nInitial value for the field.",
  bind:    "**`bind`**: `<fieldName>`\n\nTwo-way binds this field to another field's value.",
};

// ── Snippet bodies (with tab-stops $1, $2, …) ───────────────────────────────

const SNIPPETS: Record<string, { insert: string; doc: string }> = {
  "form":   {
    insert: 'form "${1:FormName}" {\n  $0\n}',
    doc:    "Scaffold a new form block",
  },
  "field text": {
    insert: 'field ${1:name} : text\n  ui { label: "${2:Label}"  placeholder: "${3:}" }\n  validate { ${4:required} }',
    doc:    "Text field with ui + validate",
  },
  "field email": {
    insert: 'field ${1:email} : email\n  ui { label: "${2:Email}"  placeholder: "${3:you@example.com}" }\n  validate { required }',
    doc:    "Email field",
  },
  "field select": {
    insert: 'field ${1:name} : select {\n  option "${2:Option A}"\n  option "${3:Option B}"\n}\n  ui { label: "${4:Label}" }',
    doc:    "Select / dropdown field with options",
  },
  "field radio": {
    insert: 'field ${1:name} : radio {\n  option "${2:Option A}"\n  option "${3:Option B}"\n}\n  ui { label: "${4:Label}" }',
    doc:    "Radio-button field",
  },
  "field checkbox": {
    insert: 'field ${1:name} : checkbox {\n  option "${2:Option A}"\n  option "${3:Option B}"\n}\n  ui { label: "${4:Label}" }',
    doc:    "Multi-select checkbox field",
  },
  "field integer": {
    insert: 'field ${1:name} : integer\n  ui { label: "${2:Label}" }\n  validate { min: ${3:0}  max: ${4:100} }',
    doc:    "Integer number field",
  },
  "field boolean": {
    insert: 'field ${1:name} : boolean\n  ui { label: "${2:Label}" }',
    doc:    "Boolean checkbox field",
  },
  "field date": {
    insert: 'field ${1:name} : date\n  ui { label: "${2:Date}" }',
    doc:    "Date-picker field",
  },
  "page": {
    insert: 'page "${1:PageName}" {\n  $0\n}',
    doc:    "Named page block",
  },
  "section": {
    insert: 'section "${1:SectionName}" {\n  $0\n}',
    doc:    "Named section block",
  },
  "group": {
    insert: 'group ${1:groupName} {\n  $0\n}',
    doc:    "Group definition",
  },
  "repeat": {
    insert: 'repeat ${1:groupName} count: ${2:countField}',
    doc:    "Repeat a group N times",
  },
  "if": {
    insert: 'if (${1:fieldName} == "${2:value}") {\n  $0\n}',
    doc:    "Conditional block",
  },
  "if/else": {
    insert: 'if (${1:fieldName} == "${2:value}") {\n  $0\n} else {\n  \n}',
    doc:    "Conditional with else branch",
  },
  "on change": {
    insert: 'on change {\n  ${1:hide} ${2:fieldName}\n}',
    doc:    "onChange trigger",
  },
  "on blur": {
    insert: 'on blur {\n  ${1:set} ${2:fieldName} = "${3:value}"\n}',
    doc:    "onBlur trigger",
  },
  "on load": {
    insert: 'on load {\n  ${1:show} ${2:fieldName}\n}',
    doc:    "onLoad trigger",
  },
  "action submit": {
    insert: 'action {\n  endpoint: "${1:/api/submit}"\n  method: ${2:POST}\n}',
    doc:    "Form submit action",
  },
  "validate": {
    insert: 'validate { ${1:required}${2:  minLength: 1} }',
    doc:    "Validation block",
  },
  "ui": {
    insert: 'ui { label: "${1:Label}"  placeholder: "${2:}" }',
    doc:    "UI annotation block",
  },
  "row": {
    insert: 'row {\n  $0\n}',
    doc:    "Horizontal two-column layout",
  },
  "compute": {
    insert: 'compute ${1:total} from ${2:a + b}',
    doc:    "Computed field",
  },
};

// ── Context detection ─────────────────────────────────────────────────────────

/** Look backwards from position to determine what context we're in. */
function detectContext(model: IModel, position: IPosition): "field_type" | "validate_block" | "on_block" | "top_level" | "ui_block" {
  const line = position.lineNumber;

  // Walk backwards up to 20 lines, counting brace depth to find enclosing block.
  let depth = 0;
  for (let l = line; l >= Math.max(1, line - 20); l--) {
    const content = model.getLineContent(l);
    for (let c = (l === line ? position.column - 1 : content.length); c >= 0; c--) {
      const ch = content[c];
      if (ch === "}") depth++;
      if (ch === "{") {
        depth--;
        if (depth < 0) {
          // We're inside this opening brace. Check what precedes it.
          const before = content.slice(0, c).trim();
          if (/\bvalidate\b/.test(before)) return "validate_block";
          if (/\bon\b/.test(before)) return "on_block";
          if (/\bui\b/.test(before)) return "ui_block";
          return "top_level";
        }
      }
    }
  }
  return "top_level";
}

/** True if the cursor follows `field <name> :` on the same line. */
function isAfterFieldColon(model: IModel, position: IPosition): boolean {
  const lineText = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
  return /\bfield\s+\w+\s*:\s*$/.test(lineText);
}

// ── Completion provider factory ───────────────────────────────────────────────

function buildCompletionProvider(monaco: Monaco) {
  const CIK = monaco.languages.CompletionItemKind;
  const IS  = monaco.languages.InsertTextRule;

  function keyword(label: string, documentation: string): any {
    return {
      label,
      kind: CIK.Keyword,
      insertText: label,
      documentation: { value: HOVER_DOCS[label] ?? documentation },
      detail: "FormL keyword",
    };
  }

  function snippet(label: string, insertText: string, doc: string): any {
    return {
      label,
      kind: CIK.Snippet,
      insertText,
      insertTextRules: IS.InsertAsSnippet,
      documentation: { value: doc },
      detail: "FormL snippet",
    };
  }

  function fieldTypeItem(type: string): any {
    return {
      label: type,
      kind: CIK.TypeParameter,
      insertText: type,
      documentation: { value: HOVER_DOCS[type] ?? "" },
      detail: "FormL field type",
    };
  }

  return {
    provideCompletionItems(model: IModel, position: IPosition) {
      const wordInfo = (model as any).getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber:   position.lineNumber,
        startColumn:     wordInfo.startColumn,
        endColumn:       wordInfo.endColumn,
      };

      // ── After `field name :` → suggest field types ────────────────────────
      if (isAfterFieldColon(model, position)) {
        return {
          suggestions: FORML_FIELD_TYPES.map((t) => ({
            ...fieldTypeItem(t),
            range,
          })),
        };
      }

      const ctx = detectContext(model, position);

      // ── Inside validate { } ───────────────────────────────────────────────
      if (ctx === "validate_block") {
        const validationItems = [
          "required", "minLength", "maxLength", "pattern", "min", "max",
        ].map((kw) => ({ ...keyword(kw, ""), range }));
        return { suggestions: validationItems };
      }

      // ── Inside on <event> { } ─────────────────────────────────────────────
      if (ctx === "on_block") {
        const actionItems = [
          "hide", "show", "clear", "set", "navigate", "submit",
        ].map((kw) => ({ ...keyword(kw, ""), range }));
        return { suggestions: actionItems };
      }

      // ── Inside ui { } ─────────────────────────────────────────────────────
      if (ctx === "ui_block") {
        const uiItems = [
          "label", "placeholder", "helpText", "default", "bind",
        ].map((kw) => ({ ...keyword(kw, ""), range }));
        return { suggestions: uiItems };
      }

      // ── Top-level / generic: all keywords + snippets ──────────────────────
      const keywordSuggestions = FORML_KEYWORDS.map((kw) => ({
        ...keyword(kw, ""),
        range,
      }));

      const snippetSuggestions = Object.entries(SNIPPETS).map(([label, { insert, doc }]) => ({
        ...snippet(label, insert, doc),
        range,
      }));

      const httpSuggestions = FORML_HTTP_METHODS.map((m) => ({
        label: m,
        kind: CIK.Enum,
        insertText: m,
        documentation: { value: `HTTP ${m}` },
        detail: "HTTP method",
        range,
      }));

      return {
        suggestions: [...keywordSuggestions, ...snippetSuggestions, ...httpSuggestions],
      };
    },
  };
}

// ── Hover provider factory ────────────────────────────────────────────────────

function buildHoverProvider() {
  return {
    provideHover(model: IModel, position: IPosition) {
      const word = (model as any).getWordAtPosition(position);
      if (!word) return null;

      const doc = HOVER_DOCS[word.word];
      if (!doc) return null;

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber:   position.lineNumber,
          startColumn:     word.startColumn,
          endColumn:       word.endColumn,
        },
        contents: [{ value: doc }],
      };
    },
  };
}

// ── Registration ──────────────────────────────────────────────────────────────

let _langServiceRegistered = false;

/**
 * Register the FormL completion + hover providers with Monaco.
 * Idempotent: safe to call multiple times (e.g. on every editor mount).
 * Must be called AFTER `defineFormixMono` since that registers the language.
 */
export function registerFormlLanguageService(monaco: Monaco): void {
  if (_langServiceRegistered) return;
  _langServiceRegistered = true;

  monaco.languages.registerCompletionItemProvider(
    "forml",
    buildCompletionProvider(monaco),
  );

  monaco.languages.registerHoverProvider(
    "forml",
    buildHoverProvider(),
  );
}
