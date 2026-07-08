// =============================================================================
// 01_tokens_and_lexing.cpp
// Forml Compiler Curriculum — File 01
//
// TOPIC: What is a token? How do we scan raw text into tokens?
//
// COMPILE: g++ -std=c++17 -Wall -o 01_tokens 01_tokens_and_lexing.cpp
// RUN:     ./01_tokens
// =============================================================================
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
//  Your compiler's job is to turn a string of characters like:
//
//      page "Contact" { field name: text }
//
//  into a tree of structured data your program can reason about.
//
//  You can't jump straight to "tree" — the raw string is just noise to a
//  program. The very first step is to break it into TOKENS: the smallest
//  meaningful units of the language.
//
//  Think of it like reading English:
//      Raw chars:  'H','e','l','l','o',',',' ','w','o','r','l','d','!'
//      Tokens:     "Hello" (word), "," (punctuation), "world" (word), "!" (punct)
//
//  The component that does this is called a LEXER (or tokenizer, or scanner).
//  After this file you will understand:
//    1. What a token is
//    2. How to scan characters one at a time
//    3. The "maximal munch" rule
//    4. How to skip whitespace and comments
//    5. How to track line/column numbers for error messages
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <cctype>    // for std::isalpha, std::isdigit, std::isspace

// =============================================================================
// SECTION 1 — What is a Token?
// =============================================================================
//
//  A token is a pair:   (KIND, TEXT)
//  - KIND  tells you the CATEGORY (e.g. "this is a string literal")
//  - TEXT  is the exact characters from the source that formed it
//
//  We also attach:
//  - LINE and COLUMN numbers so we can say "error at line 3, col 7"
//
//  We represent kinds as an integer. In 01 we use simple constants. In
//  file 02 we'll upgrade to a proper enum class.

// Token kind constants — just named ints for now
const int TOK_WORD    = 1;  // a sequence of letters: "page", "field", "name"
const int TOK_NUMBER  = 2;  // a sequence of digits: "42", "100"
const int TOK_STRING  = 3;  // a quoted literal: "Contact Us"
const int TOK_LBRACE  = 4;  // {
const int TOK_RBRACE  = 5;  // }
const int TOK_COLON   = 6;  // :
const int TOK_LPAREN  = 7;  // (
const int TOK_RPAREN  = 8;  // )
const int TOK_EOF     = 9;  // End of input — the lexer always emits this last

// A token bundles all the information together in one place.
struct Token {
    int         kind;   // what category this token belongs to
    std::string text;   // the exact source characters (e.g. the word "page")
    int         line;   // 1-indexed source line where this token STARTS
    int         col;    // 1-indexed source column where this token STARTS
};

// Helper: print a single Token in a readable format
void printToken(const Token& t) {
    // Map kind number to a human-readable name
    const char* kindName = "UNKNOWN";
    switch (t.kind) {
        case TOK_WORD:   kindName = "WORD";   break;
        case TOK_NUMBER: kindName = "NUMBER"; break;
        case TOK_STRING: kindName = "STRING"; break;
        case TOK_LBRACE: kindName = "LBRACE"; break;
        case TOK_RBRACE: kindName = "RBRACE"; break;
        case TOK_COLON:  kindName = "COLON";  break;
        case TOK_LPAREN: kindName = "LPAREN"; break;
        case TOK_RPAREN: kindName = "RPAREN"; break;
        case TOK_EOF:    kindName = "EOF";    break;
    }
    std::cout << "[" << kindName << " | \"" << t.text << "\""
              << " | line=" << t.line << " col=" << t.col << "]\n";
}

// =============================================================================
// SECTION 2 — The Scanner: Position + Cursor State
// =============================================================================
//
//  Scanning is a process of maintaining a CURSOR that moves through the
//  source string. At any moment we care about:
//    - pos:  which character we're about to look at (0-indexed)
//    - line: which source line we're on (for error messages)
//    - col:  which column on that line (for error messages)
//
//  We keep everything as local variables in the function below so you
//  can see the mechanics without class sugar getting in the way.
//  File 02 wraps all this in a class.

// =============================================================================
// SECTION 3 — Core Scanning Primitives
// =============================================================================
//
//  Every lexer is built on three basic operations:
//
//  peek()    — look at the current character WITHOUT advancing
//              (like looking at the next card without drawing it)
//
//  advance() — read the current character AND move the cursor forward
//              (update line/col too, since we just consumed a character)
//
//  We'll implement these as tiny lambdas inside the scanner function
//  below so they share the local cursor state naturally.

// =============================================================================
// SECTION 4 — Maximal Munch
// =============================================================================
//
//  When you see 'n','a','m','e',':' in the source, how do you know whether
//  to emit:
//    a) one WORD token "name" and then a COLON token ":"
//    b) one WORD token "name:"
//
//  The answer is the MAXIMAL MUNCH rule:
//    "Always consume the LONGEST sequence of characters that forms a valid token."
//
//  So for 'n','a','m','e',':':
//    - We start collecting a WORD. 'n','a','m','e' are all letters → collect them.
//    - ':' is NOT a letter → stop. Emit WORD "name".
//    - Next time around the outer loop we see ':' alone → emit COLON ":".
//
//  This is why "!=" is one token and not '!' then '='. We'll see this in the
//  operator handling of later files.

// =============================================================================
// SECTION 5 — The Full Manual Scanner Function
// =============================================================================

std::vector<Token> scanTokens(const std::string& source) {
    std::vector<Token> tokens; // We'll push tokens into this as we find them

    // Cursor state ─────────────────────────────────────────────────────────
    int pos  = 0;                        // index into source[], moves forward
    int line = 1;                        // current line number (1-indexed)
    int col  = 1;                        // current column number (1-indexed)

    // ── PRIMITIVE: peek ───────────────────────────────────────────────────
    // Returns the char at the current position without consuming it.
    // Returns '\0' (null char) if we're past the end — a safe sentinel.
    // We use a lambda here so it closes over pos/source without extra args.
    auto peek = [&]() -> char {
        if (pos >= (int)source.size()) return '\0';
        return source[pos];
    };

    // ── PRIMITIVE: advance ────────────────────────────────────────────────
    // Consumes the current character, moves the cursor forward, and
    // updates line/col so we always know where we are.
    auto advance = [&]() -> char {
        char c = source[pos];
        pos++;
        // A newline character ends the current line.
        // After seeing '\n', reset col to 1 and increment line.
        if (c == '\n') {
            line++;
            col = 1;
        } else {
            col++;  // same line, just moved one column right
        }
        return c;
    };

    // ── OUTER LOOP ────────────────────────────────────────────────────────
    // We keep looping until we exhaust the entire source string.
    while (pos < (int)source.size()) {

        // Capture WHERE this token starts BEFORE we begin consuming chars.
        // If we capture after, we'd record the position AFTER the token.
        int startLine = line;
        int startCol  = col;
        char c = peek();  // look at but don't consume yet

        // ── STEP 1: Skip whitespace ────────────────────────────────────
        // Whitespace (spaces, tabs, newlines) is not a token — it just
        // separates tokens. We consume and discard it entirely.
        // std::isspace handles ' ', '\t', '\n', '\r', '\v', '\f'.
        if (std::isspace(c)) {
            advance();  // consume the whitespace char
            continue;   // restart loop — this char produced no token
        }

        // ── STEP 2: Skip line comments ─────────────────────────────────
        // A comment starting with // runs to end of line. Like whitespace,
        // it produces no token — we just consume and move on.
        if (c == '/' && pos + 1 < (int)source.size() && source[pos + 1] == '/') {
            // We look-ahead at pos+1 without calling advance() — this is
            // a common pattern for 2-char lookahead.
            while (peek() != '\n' && peek() != '\0') {
                advance(); // consume until end of line
            }
            // Don't consume the '\n' itself here — the whitespace branch
            // above will handle it on the next iteration, keeping line
            // tracking correct.
            continue;
        }

        // ── STEP 3: Lex a WORD (identifier or keyword) ─────────────────
        // Words start with a letter or underscore, then any alphanumeric
        // or underscore. This covers: "page", "field", "name", "_count".
        if (std::isalpha(c) || c == '_') {
            std::string text;
            // Maximal munch: keep consuming as long as we see word chars
            while (std::isalpha(peek()) || std::isdigit(peek()) || peek() == '_') {
                text += advance();  // advance() returns the char it consumed
            }
            // We stopped because peek() returned a non-word character.
            // That character is still in the stream — next iteration handles it.
            tokens.push_back({TOK_WORD, text, startLine, startCol});
            continue;
        }

        // ── STEP 4: Lex a NUMBER ───────────────────────────────────────
        // A number is a sequence of digits. (We keep it simple for now;
        // floats like "3.14" come later when Forml's expression grammar needs them.)
        if (std::isdigit(c)) {
            std::string text;
            while (std::isdigit(peek())) {
                text += advance();
            }
            tokens.push_back({TOK_NUMBER, text, startLine, startCol});
            continue;
        }

        // ── STEP 5: Lex a STRING LITERAL ──────────────────────────────
        // A string literal is everything between two double-quotes.
        // We consume the opening quote, then keep reading until the
        // closing quote (or end of input — which is an error).
        if (c == '"') {
            advance(); // consume the opening '"' — it's not part of the value
            std::string text;
            while (peek() != '"' && peek() != '\0') {
                // Handle escape sequences like \n, \t, \\"
                // For now we just store the raw chars including backslash.
                // File 02 adds proper escape handling.
                text += advance();
            }
            if (peek() == '\0') {
                // We reached end of input without finding a closing quote.
                // This is a lexer error. For now we just print and bail.
                std::cerr << "ERROR [line " << line << ", col " << col
                          << "]: Unterminated string literal\n";
                break;
            }
            advance(); // consume the closing '"' — also not part of the value
            tokens.push_back({TOK_STRING, text, startLine, startCol});
            continue;
        }

        // ── STEP 6: Single-character tokens ───────────────────────────
        // Some tokens are exactly one character. We match them explicitly.
        // We advance FIRST (to consume the char), then push the token.
        switch (c) {
            case '{': advance(); tokens.push_back({TOK_LBRACE, "{", startLine, startCol}); break;
            case '}': advance(); tokens.push_back({TOK_RBRACE, "}", startLine, startCol}); break;
            case ':': advance(); tokens.push_back({TOK_COLON,  ":", startLine, startCol}); break;
            case '(': advance(); tokens.push_back({TOK_LPAREN, "(", startLine, startCol}); break;
            case ')': advance(); tokens.push_back({TOK_RPAREN, ")", startLine, startCol}); break;
            default:
                // Unknown character — print an error and skip it.
                // (In a real compiler we'd collect all errors before aborting.)
                std::cerr << "ERROR [line " << startLine << ", col " << startCol
                          << "]: Unexpected character '" << c << "'\n";
                advance(); // skip the bad char so we don't loop forever
                break;
        }
    }

    // ── STEP 7: Always append an EOF token ─────────────────────────────
    // The parser (built in later files) will ask for the "next token" in
    // a loop. Without EOF it would read past the end of the vector.
    // EOF is a safe sentinel: the parser knows to stop when it sees it.
    tokens.push_back({TOK_EOF, "", line, col});

    return tokens;
}

// =============================================================================
// SECTION 6 — main(): demonstrate the scanner on sample Forml-like input
// =============================================================================

int main() {
    // A small snippet of Forml-style syntax.
    // (We'll use the real grammar once you paste your EBNF in file 03.)
    const std::string source = R"(
// This is a comment — the lexer should ignore it
page "Contact Us" {
    field name: text
    field age: number(min: 18)
}
)";

    std::cout << "=== Source ===\n" << source << "\n";
    std::cout << "=== Tokens ===\n";

    std::vector<Token> tokens = scanTokens(source);

    for (const Token& tok : tokens) {
        printToken(tok);
    }

    std::cout << "\nTotal tokens: " << tokens.size() << "\n";
    return 0;
}

// =============================================================================
// TRY THIS — exercises to deepen your understanding
// =============================================================================
//
//  1. ADD MULTI-LINE COMMENT SUPPORT
//     Forml might need /* ... */ style comments (they nest in some languages).
//     Right now only // line comments are handled. Add /* ... */ support.
//     Hint: when you see '/*', loop calling advance() until you see '*/',
//     tracking line/col as you go. What happens to the line counter when
//     the comment spans multiple lines?
//
//  2. ADD FLOAT NUMBER SUPPORT
//     Change the number-lexing branch to handle "3.14" and "0.5".
//     After consuming digits, peek() for a '.', and if found, consume it
//     and any following digits. What should you do if the source says "3."
//     (a dot with nothing after it)?
//
//  3. INSTRUMENT ERROR COUNTING
//     Add an `int errorCount = 0;` variable. Every time you print an error,
//     increment it. At the end of scanTokens(), if errorCount > 0, return an
//     empty vector to signal failure. How would the caller (main()) detect
//     this and handle it gracefully?
//
// =============================================================================
