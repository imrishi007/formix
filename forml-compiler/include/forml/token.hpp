// =============================================================================
//  include/forml/token.hpp
//  Forml Compiler — Stage 0: Token Definitions
// =============================================================================
//
//  PURPOSE
//  -------
//  This file defines the entire "vocabulary" of the Forml DSL as seen by the
//  lexer and parser.  In compiler construction, a "token" is the smallest
//  meaningful unit in a language — just like words are the smallest meaningful
//  units in English.  The lexer reads raw characters and groups them into
//  tokens; the parser reads those tokens and groups them into grammar rules.
//
//  Three things live here:
//    1. TokenType — an enum class naming every kind of token the Forml grammar
//                   can produce.  Derived exhaustively from EBNF_grammar.md.
//    2. Token     — a struct pairing a TokenType with its raw text and where
//                   in the source file it appeared (line + column).
//    3. tokenTypeToString() — debug helper for printing readable token tables.
//
//  WHY enum class (not plain enum)?
//  ---------------------------------
//  A plain `enum` dumps all names into the enclosing scope, which causes
//  collisions (e.g. your own variable named "ERROR" would clash with the
//  token ERROR).  `enum class` (C++11) scopes names under the type, so you
//  must write TokenType::ERROR — impossible to collide.
//
// =============================================================================

#pragma once   // Guard: ensures this file is included at most once per
               // compilation unit, preventing duplicate-definition errors.

#include <string>

namespace forml {

// =============================================================================
//  TokenType
// =============================================================================
//  Every entry below corresponds to a terminal in EBNF_grammar.md, or to a
//  meta-token needed by the compiler infrastructure (END_OF_FILE, ERROR).
//
//  Reading strategy for the grammar → token mapping:
//    • Quoted strings in the EBNF (e.g. "form", "{", "==") → keywords or
//      fixed punctuation/operator tokens below.
//    • Named terminals in ALL-CAPS (IDENTIFIER, STRING, NUMBER) → literal
//      token types that carry variable content.
//
//  The groups below mirror the structure of EBNF_grammar.md so you can cross-
//  check easily.
// =============================================================================

enum class TokenType {

    // =========================================================================
    //  §2  Form & Page Structure
    // =========================================================================
    //  These keywords open the major structural blocks of a .forml file.

    KW_FORM,        // "form"    — root form block opener
    KW_PAGE,        // "page"    — named page block (multi-step wizard support)
    KW_GROUP,       // "group"   — group_definition: reusable field template
    KW_USE,         // "use"     — group_use: instantiate a named group
    KW_VAR,         // "var"     — var_declaration: compile-time constant
    KW_SECTION,     // "section" — visual grouping of statements under a heading
    KW_FIELD,       // "field"   — declares one form input

    // =========================================================================
    //  §3  Reusability helpers (already covered above: group / use / var)
    // =========================================================================
    //  (No new tokens needed; KW_GROUP, KW_USE, KW_VAR are declared above.)

    // =========================================================================
    //  §4  Field Types
    // =========================================================================
    //  These appear as the right-hand side of "field name : TYPE".

    KW_TEXT,        // "text"     — plain text input
    KW_INTEGER,     // "integer"  — whole-number input
    KW_FLOAT,       // "float"    — decimal-number input
    KW_EMAIL,       // "email"    — email input (format-validated by browser)
    KW_DATE,        // "date"     — date picker
    KW_BOOLEAN,     // "boolean"  — checkbox (single true/false)
    KW_URL,         // "url"      — URL input (also re-used in source_block:
                    //              "from url STRING").  The parser uses context
                    //              to know which role it plays — the lexer just
                    //              emits KW_URL for the string "url" everywhere.
    KW_SELECT,      // "select"   — dropdown list
    KW_RADIO,       // "radio"    — radio button group
    KW_CHECKBOX,    // "checkbox" — checkbox group (multi-select)
    KW_OPTION,      // "option"   — one item inside a select/radio/checkbox block

    // =========================================================================
    //  §4  Data Sourcing
    // =========================================================================
    //  Keywords that appear inside source_block.

    KW_FROM,        // "from"  — opens a source_block ("from url ..." / "from var ...")
    KW_MAP,         // "map"   — maps API JSON keys to label/value
    KW_LABEL,       // "label" — target key for the display text in a map block
                    //           (also re-used in ui_block as "label: STRING")
    KW_VALUE,       // "value" — target key for the option value in a map block

    // =========================================================================
    //  §5  Presentation (ui_block) and Validation (validation_block)
    // =========================================================================

    KW_UI,          // "ui"          — opens a ui { ... } block
    KW_VALIDATE,    // "validate"    — opens a validate { ... } block

    // ui_rule keywords
    KW_PLACEHOLDER, // "placeholder" — hint text shown inside the input
    KW_HELP_TEXT,   // "helpText"    — note shown below the input
    KW_DEFAULT,     // "default"     — pre-populated value
    KW_BIND,        // "bind"        — two-way binding to external state key

    // validation_rule keywords
    KW_REQUIRED,    // "required"    — field must be non-empty (no argument)
    KW_MIN,         // "min"         — numeric minimum value
    KW_MAX,         // "max"         — numeric maximum value
    KW_MIN_LENGTH,  // "minLength"   — minimum string length
    KW_MAX_LENGTH,  // "maxLength"   — maximum string length
    KW_PATTERN,     // "pattern"     — regex pattern the value must match

    // Layout keywords (§5)
    KW_ROW,         // "row"    — horizontal layout block
    KW_COLUMN,      // "column" — vertical layout block

    // =========================================================================
    //  §6  Logic, Math, and Dynamics
    // =========================================================================

    KW_IF,          // "if"      — conditional statement
    KW_ELSE,        // "else"    — else branch
    KW_REPEAT,      // "repeat"  — dynamic repeat block
    KW_COUNT,       // "count"   — the "count = IDENTIFIER" clause in repeat_group
    KW_COMPUTE,     // "compute" — compute_block: "compute = expression"

    // =========================================================================
    //  §7  Actions and Lifecycle Triggers
    // =========================================================================

    KW_ACTION,      // "action"   — opens an action block at form level
    KW_SUBMIT,      // "submit"   — DUAL ROLE:
                    //   a) event_type  inside trigger_block: "on submit { ... }"
                    //   b) keyword     inside action_block:  "action submit { ... }"
                    //   c) action_stmt inside trigger_block: "submit()"
                    //   The parser resolves context; the lexer always emits KW_SUBMIT.

    KW_ON,          // "on"      — opens a trigger_block
    KW_LOAD,        // "load"    — event: field/page just loaded
    KW_CHANGE,      // "change"  — event: field value changed
    KW_BLUR,        // "blur"    — event: field lost focus

    // action_statement keywords
    KW_HIDE,        // "hide"     — action: hide a named field
    KW_SHOW,        // "show"     — action: make a named field visible
    KW_CLEAR,       // "clear"    — action: reset a field to empty
    KW_SET,         // "set"      — action: assign a value to a field
    KW_NAVIGATE,    // "navigate" — action: redirect to a URL

    // action_block internals
    KW_ENDPOINT,    // "endpoint" — submission URL
    KW_METHOD,      // "method"   — HTTP method keyword

    // HTTP method literals (grammar: "POST" | "PUT" | "PATCH")
    // These are uppercase identifiers whose meaning is fixed by the grammar,
    // not chosen by the user, so we treat them as distinct keyword tokens.
    KW_POST,        // "POST"
    KW_PUT,         // "PUT"
    KW_PATCH,       // "PATCH"

    // Boolean literal keywords (grammar: "true" | "false")
    KW_TRUE,        // "true"
    KW_FALSE,       // "false"

    // =========================================================================
    //  User-Defined Tokens (variable content — the actual text matters)
    // =========================================================================

    IDENTIFIER,     // A user-chosen name: starts with a letter (a-z, A-Z),
                    // followed by letters, digits, or underscores.
                    // e.g. "owner_name", "fleet_size", "AddressBlock".
                    //
                    // IMPORTANT: The lexer scans potential identifiers and then
                    // looks them up in the keyword table.  If it's a keyword,
                    // we emit the corresponding KW_* token instead of IDENTIFIER.
                    // This is the standard "keyword-as-reserved-identifier" trick
                    // used by virtually every hand-written lexer.

    STRING,         // A double-quoted string literal.
                    // e.g. "Fleet Registration", "https://api.example.com"
                    // The lexeme stored in Token::lexeme INCLUDES the double
                    // quotes, so the parser can easily strip them if needed.

    NUMBER,         // An integer or floating-point literal.
                    // Grammar: digit { digit } [ "." { digit } ]
                    // e.g. "42", "3.14", "1900", "0"
                    // The lexeme is the raw text; the parser converts to numeric
                    // type when it needs the actual value.

    // =========================================================================
    //  Punctuation and Delimiters
    // =========================================================================
    //  Single-character tokens — each character maps to exactly one token type.

    LEFT_BRACE,     // {   opens a block
    RIGHT_BRACE,    // }   closes a block
    LEFT_PAREN,     // (   opens an argument list (action statements)
    RIGHT_PAREN,    // )   closes an argument list
    COLON,          // :   separates property name from value (e.g. "label: ...")
    SEMICOLON,      // ;   terminates a var_declaration
    COMMA,          // ,   separates arguments (e.g. set(field, value))
    EQUALS,         // =   assignment (var x = 5 ; or repeat count = x)
                    //     NOTE: a standalone = is EQUALS; a double == is EQ (below).
                    //     Maximal munch: the lexer checks if '=' is followed by '='.

    // =========================================================================
    //  Arithmetic Operators  (§6 compute_block / expression)
    // =========================================================================

    PLUS,           // +   addition
    MINUS,          // -   subtraction
    STAR,           // *   multiplication
    SLASH,          // /   division
                    //     NOTE: single / is SLASH; // (double slash) starts a
                    //     line comment and is consumed by skipWhitespaceAndComments.

    // =========================================================================
    //  Comparison Operators  (§6 comparator)
    // =========================================================================
    //  All multi-character operators require "maximal munch": the lexer always
    //  consumes as many characters as possible to form the longest valid token.
    //  So when it sees '<' it peeks at the next char: if '=' → LTE, else → LT.

    EQ,             // ==  equality test
    NEQ,            // !=  inequality test
    LT,             // <   less than
    GT,             // >   greater than
    LTE,            // <=  less than or equal
    GTE,            // >=  greater than or equal

    // =========================================================================
    //  Logical Operators  (§6 condition)
    // =========================================================================

    AND,            // &&  logical AND  (higher precedence than ||)
    OR,             // ||  logical OR   (lowest precedence in conditions)

    // =========================================================================
    //  Infrastructure / Meta Tokens
    // =========================================================================

    END_OF_FILE,    // Emitted once when the lexer reaches the end of the source
                    // string.  The parser uses this as a safe sentinel so it
                    // never reads past the end of the token stream.

    ERROR           // Emitted when the lexer hits a character it cannot classify.
                    // The DiagnosticEngine records the exact position; scanning
                    // continues so we can report all errors in one pass rather
                    // than stopping at the first unknown character.
};


// =============================================================================
//  Token
// =============================================================================
//  A Token is what the Lexer hands to the Parser.  It packages together:
//
//    type    — WHAT kind of thing this token is (from the enum above)
//    lexeme  — the RAW source text that produced this token
//              e.g.  STRING "Hello" has lexeme = "\"Hello\""  (quotes included)
//                    NUMBER 42     has lexeme = "42"
//                    KW_FORM       has lexeme = "form"
//    line    — 1-based line number in the source file
//    column  — 1-based column number of the FIRST character of this token
//
//  WHY store line and column on every token?
//  -----------------------------------------
//  Error messages like:
//    [ParseError] Line 4, Col 12: Expected ':' after field name
//  are only useful if the parser can point to the EXACT position.  Since the
//  parser works with tokens (not characters), every token must carry its
//  source coordinates, stamped at scan time.
// =============================================================================

struct Token {
    TokenType   type;
    std::string lexeme;
    int         line;    // 1-based: first line of file = line 1
    int         column;  // 1-based: first char of each line = column 1
};


// =============================================================================
//  tokenTypeToString
// =============================================================================
//  Maps a TokenType enum value to a short, human-readable string.
//  Used by:
//    • test_lexer.cpp   — pretty-print token tables during lexer review
//    • diagnostics      — produce readable error messages in later stages
//
//  This is a free function (not a method) because it is stateless — it is
//  purely a lookup table from enum → string.  The implementation lives in
//  token.cpp so the enum-to-string mapping is defined in exactly one place.
// =============================================================================

std::string tokenTypeToString(TokenType type);

} // namespace forml
