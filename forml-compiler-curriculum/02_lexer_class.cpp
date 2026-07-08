// =============================================================================
// 02_lexer_class.cpp
// Forml Compiler Curriculum — File 02
//
// TOPIC: Wrapping the scanner in a proper Lexer class. Introducing enum class
//        for token types. Building a complete vector<Token> from a string.
//
// COMPILE: g++ -std=c++17 -Wall -o 02_lexer 02_lexer_class.cpp
// RUN:     ./02_lexer
// =============================================================================
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
//  In file 01 the scanner was one big free function.
//  That works, but in a real compiler the lexer is called from many places
//  (the parser, the error reporter, perhaps an IDE language server), and it
//  needs to carry state around (cursor position, accumulated errors, etc.)
//
//  This file upgrades the scanner to a class with:
//    • A proper enum class TokenType  — no magic ints
//    • Private member variables for source, pos, line, col
//    • A public tokenize() method that returns vector<Token>
//    • An internal error-collection mechanism (don't crash on first error)
//    • Keyword recognition (distinguishing "page" from "myPage")
//    • Escape-sequence handling inside string literals
//
//  After this file the Lexer class will be the *exact* one we import into
//  every subsequent file. Nothing will change its public interface.
//
// =============================================================================

#include <iostream>
#include <string>
#include <string_view>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <stdexcept>
#include <cctype>

// =============================================================================
// SECTION 1 — enum class TokenType
// =============================================================================
//
//  In file 01 we used plain int constants (TOK_WORD = 1, etc.).
//  The problem: nothing stops you from writing
//      if (tok.kind == 42) { ... }   // which "42" is this??
//
//  enum class fixes this:
//    • Each value has a FULLY QUALIFIED name: TokenType::Word
//    • You cannot accidentally compare a TokenType with an int
//    • The compiler catches typos at compile time, not runtime
//
//  We declare this OUTSIDE the Lexer class because the Parser (file 05+)
//  also needs to refer to these values, and we want one shared definition.

enum class TokenType {
    // ── Literals ──────────────────────────────────────────────────────
    Identifier,     // user-defined names: "name", "myField", "_count"
    StringLit,      // "Contact Us", "required message here"
    IntLit,         // 42, 100
    FloatLit,       // 3.14, 0.5  (added in this file)

    // ── Keywords ──────────────────────────────────────────────────────
    // These look like identifiers during scanning but are reserved words.
    // We handle them by scanning a word, then checking a keyword table.
    KwPage,         // page
    KwField,        // field
    KwGroup,        // group
    KwAction,       // action
    KwIf,           // if
    KwElse,         // else
    KwComputed,     // computed
    KwRequired,     // required
    KwOptional,     // optional
    KwTrue,         // true
    KwFalse,        // false

    // ── Punctuation ───────────────────────────────────────────────────
    LBrace,         // {
    RBrace,         // }
    LParen,         // (
    RParen,         // )
    LBracket,       // [
    RBracket,       // ]
    Colon,          // :
    Comma,          // ,
    Semicolon,      // ;
    Dot,            // .
    Arrow,          // ->   (two chars — watch for maximal munch!)
    Equals,         // =
    EqEq,           // ==
    BangEq,         // !=
    Bang,           // !
    Lt,             // <
    Gt,             // >
    LtEq,           // <=
    GtEq,           // >=
    Plus,           // +
    Minus,          // -
    Star,           // *
    Slash,          // /
    Percent,        // %
    Pipe,           // |
    Ampersand,      // &
    Question,       // ?
    At,             // @

    // ── Special ───────────────────────────────────────────────────────
    Eof,            // end of input — always the last token
    Error,          // a lexer error token (bad char, unterminated string, etc.)
};

// Helper: turn a TokenType into a printable string (for debugging)
// In a production compiler you'd auto-generate this from a table, but
// writing it by hand once cements the vocabulary in your head.
const char* tokenTypeName(TokenType tt) {
    switch (tt) {
        case TokenType::Identifier: return "Identifier";
        case TokenType::StringLit:  return "StringLit";
        case TokenType::IntLit:     return "IntLit";
        case TokenType::FloatLit:   return "FloatLit";
        case TokenType::KwPage:     return "KwPage";
        case TokenType::KwField:    return "KwField";
        case TokenType::KwGroup:    return "KwGroup";
        case TokenType::KwAction:   return "KwAction";
        case TokenType::KwIf:       return "KwIf";
        case TokenType::KwElse:     return "KwElse";
        case TokenType::KwComputed: return "KwComputed";
        case TokenType::KwRequired: return "KwRequired";
        case TokenType::KwOptional: return "KwOptional";
        case TokenType::KwTrue:     return "KwTrue";
        case TokenType::KwFalse:    return "KwFalse";
        case TokenType::LBrace:     return "LBrace";
        case TokenType::RBrace:     return "RBrace";
        case TokenType::LParen:     return "LParen";
        case TokenType::RParen:     return "RParen";
        case TokenType::LBracket:   return "LBracket";
        case TokenType::RBracket:   return "RBracket";
        case TokenType::Colon:      return "Colon";
        case TokenType::Comma:      return "Comma";
        case TokenType::Semicolon:  return "Semicolon";
        case TokenType::Dot:        return "Dot";
        case TokenType::Arrow:      return "Arrow";
        case TokenType::Equals:     return "Equals";
        case TokenType::EqEq:       return "EqEq";
        case TokenType::BangEq:     return "BangEq";
        case TokenType::Bang:       return "Bang";
        case TokenType::Lt:         return "Lt";
        case TokenType::Gt:         return "Gt";
        case TokenType::LtEq:       return "LtEq";
        case TokenType::GtEq:       return "GtEq";
        case TokenType::Plus:       return "Plus";
        case TokenType::Minus:      return "Minus";
        case TokenType::Star:       return "Star";
        case TokenType::Slash:      return "Slash";
        case TokenType::Percent:    return "Percent";
        case TokenType::Pipe:       return "Pipe";
        case TokenType::Ampersand:  return "Ampersand";
        case TokenType::Question:   return "Question";
        case TokenType::At:         return "At";
        case TokenType::Eof:        return "Eof";
        case TokenType::Error:      return "Error";
    }
    return "???";
}

// =============================================================================
// SECTION 2 — The Token struct (upgraded from file 01)
// =============================================================================
//
//  The key difference from file 01: kind is now TokenType, not int.
//  This makes the parser code much more readable:
//      if (tok.type == TokenType::KwPage)  ← intent is crystal-clear
//  vs.
//      if (tok.kind == 1)                  ← what is 1?? have to look it up

struct Token {
    TokenType   type;   // the category (strong-typed now)
    std::string text;   // exact source text (kept for error messages and identifiers)
    int         line;   // 1-indexed source line
    int         col;    // 1-indexed source column
};

// Helper: print a token (same idea as file 01, but uses enum names)
void printToken(const Token& t) {
    std::cout << std::left;
    std::cout << "  [" << tokenTypeName(t.type);
    if (!t.text.empty())
        std::cout << " | \"" << t.text << "\"";
    std::cout << " @ " << t.line << ":" << t.col << "]\n";
}

// =============================================================================
// SECTION 3 — The Lexer class
// =============================================================================
//
//  Design principles:
//    • All mutable state is private  — pos, line, col, errors
//    • The public API is tiny:        Lexer(source) + tokenize()
//    • Errors are COLLECTED, not thrown — the caller gets all errors at once
//    • peek() and advance() are private helpers — not part of the API
//
//  WHY collect errors instead of throwing?
//    If you throw on the first bad token, you give the user ONE error message
//    per compile attempt. That's annoying (fix one typo, get a new error).
//    Real compilers collect all lexer errors and report them together.

class Lexer {
public:
    // ── Construction ──────────────────────────────────────────────────────
    // We take the source by value (copy). For large files you'd take a
    // string_view to avoid copying, but for a compiler processing <10MB
    // files a copy is fine and simpler to reason about.
    explicit Lexer(std::string source)
        : source_(std::move(source))  // move: no copy of the string
        , pos_(0)
        , line_(1)
        , col_(1)
    {}

    // ── Main entry point ──────────────────────────────────────────────────
    // Scans the entire source and returns all tokens.
    // Errors are appended to errors_ — call hasErrors() / errors() after.
    std::vector<Token> tokenize() {
        std::vector<Token> tokens;

        while (pos_ < (int)source_.size()) {
            // Skip whitespace and comments first.
            // We loop here because whitespace might be followed by more whitespace.
            if (skipWhitespaceAndComments()) continue;
            if (pos_ >= (int)source_.size()) break;

            // Now we're pointing at the start of a real token.
            Token tok = nextToken();
            tokens.push_back(tok);
        }

        // The parser always expects an EOF at the end.
        tokens.push_back(makeToken(TokenType::Eof, ""));
        return tokens;
    }

    // ── Error inspection ──────────────────────────────────────────────────
    bool hasErrors() const { return !errors_.empty(); }

    const std::vector<std::string>& errors() const { return errors_; }

private:
    // ══════════════════════════════════════════════════════════════════════
    //  Private state
    // ══════════════════════════════════════════════════════════════════════
    std::string source_;           // the full source text (immutable after construction)
    int         pos_;              // index of the next character to read
    int         line_;             // current source line  (1-indexed)
    int         col_;              // current source column (1-indexed)
    std::vector<std::string> errors_; // accumulated lexer errors

    // ── Keyword table ─────────────────────────────────────────────────────
    // We scan ALL word-like strings as Identifiers first, then look them up
    // here. This table maps the raw string to the keyword's TokenType.
    //
    // WHY a static member?
    // The table is the same for every Lexer instance. Making it static means
    // it's constructed once at program startup, not once per Lexer object.
    // (You'd see this as a 'const static' in many production compilers.)
    static const std::unordered_map<std::string, TokenType>& keywords() {
        static const std::unordered_map<std::string, TokenType> kw = {
            {"page",     TokenType::KwPage},
            {"field",    TokenType::KwField},
            {"group",    TokenType::KwGroup},
            {"action",   TokenType::KwAction},
            {"if",       TokenType::KwIf},
            {"else",     TokenType::KwElse},
            {"computed", TokenType::KwComputed},
            {"required", TokenType::KwRequired},
            {"optional", TokenType::KwOptional},
            {"true",     TokenType::KwTrue},
            {"false",    TokenType::KwFalse},
        };
        return kw;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Core scanning primitives
    // ══════════════════════════════════════════════════════════════════════

    // Look at the current char without consuming it.
    char peek() const {
        if (pos_ >= (int)source_.size()) return '\0';
        return source_[pos_];
    }

    // Look one char AHEAD of the current position.
    // Used for two-char tokens like -> == != <= >=
    char peekNext() const {
        if (pos_ + 1 >= (int)source_.size()) return '\0';
        return source_[pos_ + 1];
    }

    // Consume the current char, advance cursor, update line/col.
    char advance() {
        char c = source_[pos_++];
        if (c == '\n') { line_++; col_ = 1; }
        else           { col_++; }
        return c;
    }

    // Consume current char only if it matches 'expected'. Returns true if consumed.
    // This is the "conditional advance" — used for two-char tokens.
    bool match(char expected) {
        if (pos_ >= (int)source_.size()) return false;
        if (source_[pos_] != expected)   return false;
        advance();
        return true;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Whitespace and comment skipping
    // ══════════════════════════════════════════════════════════════════════

    // Returns true if it consumed at least one whitespace/comment character.
    // The caller loops while this returns true before trying to lex a token.
    bool skipWhitespaceAndComments() {
        bool skipped = false;

        while (pos_ < (int)source_.size()) {
            char c = peek();

            // Plain whitespace
            if (std::isspace(c)) {
                advance();
                skipped = true;
                continue;
            }

            // Line comment: // ...
            if (c == '/' && peekNext() == '/') {
                while (peek() != '\n' && peek() != '\0') advance();
                skipped = true;
                continue;
            }

            // Block comment: /* ... */
            // We track depth in case you want nested /* /* */ */ later.
            if (c == '/' && peekNext() == '*') {
                int startLine = line_, startCol = col_;
                advance(); advance(); // consume /*
                while (!(peek() == '*' && peekNext() == '/')) {
                    if (peek() == '\0') {
                        // Reached end of input inside a block comment.
                        addError(startLine, startCol, "Unterminated block comment /* */");
                        return true;
                    }
                    advance();
                }
                advance(); advance(); // consume */
                skipped = true;
                continue;
            }

            break; // not whitespace or comment — stop
        }

        return skipped;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Token construction helpers
    // ══════════════════════════════════════════════════════════════════════

    // Build a Token at the CURRENT line/col with the given type and text.
    // "Current" means the position stored in line_/col_ RIGHT NOW.
    // Call this BEFORE advancing past the token's characters.
    Token makeTokenAt(int line, int col, TokenType type, std::string text) {
        return Token{type, std::move(text), line, col};
    }

    Token makeToken(TokenType type, std::string text) {
        return Token{type, std::move(text), line_, col_};
    }

    // ══════════════════════════════════════════════════════════════════════
    //  Error recording
    // ══════════════════════════════════════════════════════════════════════

    void addError(int line, int col, const std::string& msg) {
        errors_.push_back("Lexer error [" + std::to_string(line) + ":" +
                          std::to_string(col) + "]: " + msg);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  nextToken() — dispatch to the right lex_* method
    // ══════════════════════════════════════════════════════════════════════
    //
    //  This is the central dispatch. We look at peek() and decide which
    //  kind of token to produce. Each branch calls a specialized helper.

    Token nextToken() {
        int startLine = line_;
        int startCol  = col_;
        char c = advance(); // consume the first character of the token

        // ── Identifiers and keywords ───────────────────────────────────
        if (std::isalpha(c) || c == '_') {
            return lexWord(c, startLine, startCol);
        }

        // ── Numbers ────────────────────────────────────────────────────
        if (std::isdigit(c)) {
            return lexNumber(c, startLine, startCol);
        }

        // ── String literals ────────────────────────────────────────────
        if (c == '"') {
            return lexString(startLine, startCol);
        }

        // ── Two-char operators (maximal munch!) ────────────────────────
        // We already consumed one char (c). Now we peek at the NEXT char
        // to decide if this is a two-char operator. match() consumes the
        // second char only if it matches.
        switch (c) {
            // '-' handled separately to avoid calling match() twice in a ternary.
            // lexMinus() correctly calls match('>') exactly once.
            case '-': return lexMinus(startLine, startCol);

            case '=': {
                if (match('=')) return makeTokenAt(startLine, startCol, TokenType::EqEq,  "==");
                return makeTokenAt(startLine, startCol, TokenType::Equals, "=");
            }
            case '!': {
                if (match('=')) return makeTokenAt(startLine, startCol, TokenType::BangEq, "!=");
                return makeTokenAt(startLine, startCol, TokenType::Bang, "!");
            }
            case '<': {
                if (match('=')) return makeTokenAt(startLine, startCol, TokenType::LtEq, "<=");
                return makeTokenAt(startLine, startCol, TokenType::Lt, "<");
            }
            case '>': {
                if (match('=')) return makeTokenAt(startLine, startCol, TokenType::GtEq, ">=");
                return makeTokenAt(startLine, startCol, TokenType::Gt, ">");
            }

            // ── Single-char punctuation ────────────────────────────────
            case '{': return makeTokenAt(startLine, startCol, TokenType::LBrace,    "{");
            case '}': return makeTokenAt(startLine, startCol, TokenType::RBrace,    "}");
            case '(': return makeTokenAt(startLine, startCol, TokenType::LParen,    "(");
            case ')': return makeTokenAt(startLine, startCol, TokenType::RParen,    ")");
            case '[': return makeTokenAt(startLine, startCol, TokenType::LBracket,  "[");
            case ']': return makeTokenAt(startLine, startCol, TokenType::RBracket,  "]");
            case ':': return makeTokenAt(startLine, startCol, TokenType::Colon,     ":");
            case ',': return makeTokenAt(startLine, startCol, TokenType::Comma,     ",");
            case ';': return makeTokenAt(startLine, startCol, TokenType::Semicolon, ";");
            case '.': return makeTokenAt(startLine, startCol, TokenType::Dot,       ".");
            case '+': return makeTokenAt(startLine, startCol, TokenType::Plus,      "+");
            case '*': return makeTokenAt(startLine, startCol, TokenType::Star,      "*");
            case '/': return makeTokenAt(startLine, startCol, TokenType::Slash,     "/");
            case '%': return makeTokenAt(startLine, startCol, TokenType::Percent,   "%");
            case '|': return makeTokenAt(startLine, startCol, TokenType::Pipe,      "|");
            case '&': return makeTokenAt(startLine, startCol, TokenType::Ampersand, "&");
            case '?': return makeTokenAt(startLine, startCol, TokenType::Question,  "?");
            case '@': return makeTokenAt(startLine, startCol, TokenType::At,        "@");

            default: {
                // Unknown character. We record the error but return an Error
                // token instead of crashing — the parser will decide what to do.
                std::string msg = "Unexpected character '";
                msg += c;
                msg += "'";
                addError(startLine, startCol, msg);
                return makeTokenAt(startLine, startCol, TokenType::Error,
                                   std::string(1, c));
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  lexWord — scan an identifier, then look it up in the keyword table
    // ══════════════════════════════════════════════════════════════════════

    Token lexWord(char first, int startLine, int startCol) {
        // 'first' is the character we already consumed in nextToken().
        // We start the accumulated text with it.
        std::string text(1, first);

        // Maximal munch: keep consuming alphanumeric chars and underscores.
        while (std::isalpha(peek()) || std::isdigit(peek()) || peek() == '_') {
            text += advance();
        }

        // Check if this word is a reserved keyword.
        // find() returns end() if not found — then it's a plain Identifier.
        const auto& kw = keywords();
        auto it = kw.find(text);
        TokenType type = (it != kw.end()) ? it->second : TokenType::Identifier;

        return makeTokenAt(startLine, startCol, type, text);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  lexNumber — scan an integer or float literal
    // ══════════════════════════════════════════════════════════════════════

    Token lexNumber(char first, int startLine, int startCol) {
        std::string text(1, first);

        // Consume integer part
        while (std::isdigit(peek())) {
            text += advance();
        }

        // Check for a decimal point followed by more digits (float)
        if (peek() == '.' && std::isdigit(peekNext())) {
            text += advance();  // consume '.'
            while (std::isdigit(peek())) {
                text += advance();
            }
            return makeTokenAt(startLine, startCol, TokenType::FloatLit, text);
        }

        return makeTokenAt(startLine, startCol, TokenType::IntLit, text);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  lexString — scan a double-quoted string literal with escape sequences
    // ══════════════════════════════════════════════════════════════════════
    //
    //  We're already PAST the opening '"' (nextToken consumed it).
    //  We scan until the matching '"', interpreting backslash escapes.
    //
    //  Important: 'text' stores the DECODED value, not the raw source.
    //  So "\n" in source becomes a real newline character in text.
    //  This matters for code-generation/serialization later.

    Token lexString(int startLine, int startCol) {
        std::string text;  // decoded content (no surrounding quotes)

        while (peek() != '"' && peek() != '\0') {
            char c = advance();

            if (c == '\\') {
                // Escape sequence — look at the next character
                char esc = advance();
                switch (esc) {
                    case 'n':  text += '\n'; break;
                    case 't':  text += '\t'; break;
                    case 'r':  text += '\r'; break;
                    case '"':  text += '"';  break;
                    case '\\': text += '\\'; break;
                    default:
                        // Unknown escape: we include both chars literally and warn
                        addError(line_, col_-1,
                                 std::string("Unknown escape sequence '\\") + esc + "'");
                        text += '\\';
                        text += esc;
                        break;
                }
            } else {
                text += c;
            }
        }

        if (peek() == '\0') {
            addError(startLine, startCol, "Unterminated string literal");
            return makeTokenAt(startLine, startCol, TokenType::Error, text);
        }

        advance(); // consume closing '"'
        return makeTokenAt(startLine, startCol, TokenType::StringLit, text);
    }

    // Fix the broken '->' / '-' logic from nextToken (the switch has a bug for
    // demonstration — here's the correct version):
    Token lexMinus(int startLine, int startCol) {
        if (match('>')) return makeTokenAt(startLine, startCol, TokenType::Arrow, "->");
        return makeTokenAt(startLine, startCol, TokenType::Minus, "-");
    }
};

// =============================================================================
// SECTION 4 — main(): test the Lexer class end to end
// =============================================================================

int main() {
    // Test 1: basic Forml-like snippet
    {
        const std::string source = R"(
// Forml form definition
page "Sign Up" {
    field username: text
    field age: number(min: 18, max: 120)
    computed fullAge: age + 1
    if (age >= 18) {
        field adultConsent: boolean
    }
}
)";

        std::cout << "=== Test 1: Basic Forml snippet ===\n\n";
        Lexer lexer(source);
        auto tokens = lexer.tokenize();

        for (const auto& tok : tokens) {
            printToken(tok);
        }

        if (lexer.hasErrors()) {
            std::cout << "\n--- Lexer errors ---\n";
            for (const auto& err : lexer.errors()) {
                std::cout << err << "\n";
            }
        }
    }

    std::cout << "\n";

    // Test 2: error recovery — bad chars should not stop scanning
    {
        const std::string source = R"(field name: text $ field age: number)";

        std::cout << "=== Test 2: Error recovery ($) ===\n\n";
        Lexer lexer(source);
        auto tokens = lexer.tokenize();

        for (const auto& tok : tokens) {
            printToken(tok);
        }

        if (lexer.hasErrors()) {
            std::cout << "\n--- Lexer errors ---\n";
            for (const auto& err : lexer.errors()) {
                std::cout << err << "\n";
            }
        }
    }

    std::cout << "\n";

    // Test 3: two-char operators and string escapes
    {
        const std::string source = R"(
result == "done\n" -> action
value != 0
count >= 5
label -> "tab:\there"
)";
        std::cout << "=== Test 3: Operators and escape sequences ===\n\n";
        Lexer lexer(source);
        auto tokens = lexer.tokenize();

        for (const auto& tok : tokens) {
            printToken(tok);
        }
    }

    return 0;
}

// =============================================================================
// TRY THIS
// =============================================================================
//
//  1. ADD A NEW KEYWORD
//     Add "validate" as a keyword to the keywords() table so it gets type
//     KwValidate (you'll also need to add that to the enum and to
//     tokenTypeName()). Then add "validate foo" to Test 1 and verify the
//     token type changes from Identifier to your new keyword type.
//
//  2. MULTI-LINE STRINGS (raw strings)
//     Add support for backtick strings: `hello world\nno escapes here`.
//     Unlike double-quoted strings, backtick strings should NOT process
//     escape sequences — every character is literal. Where in the code
//     do you branch to handle this? What new TokenType would you add?
//
//  3. INTEGER BASES
//     Add support for hexadecimal literals like 0xFF and octal like 0o77.
//     In lexNumber(), after consuming '0', peek() at the next char.
//     If it's 'x', consume and scan hex digits [0-9a-fA-F].
//     If it's 'o', consume and scan octal digits [0-7].
//     Store the raw text "0xFF" in the token — convert to int later in
//     the semantic pass. Why is deferring conversion better?
//
// =============================================================================
