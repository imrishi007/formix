// include/forml/lexer.hpp - lexer interface for tokenizing Forml source.

#pragma once

#include "forml/token.hpp"
#include "forml/diagnostics.hpp"

#include <string>
#include <vector>
#include <unordered_map>

namespace forml {

// Lexer converts source text into a token stream.

class Lexer {
public:
    // Constructs a lexer for the given source and diagnostic sink.
    Lexer(const std::string& source, DiagnosticEngine& diag);

    // Tokenizes the full source and returns the resulting token stream.
    std::vector<Token> tokenize();

private:
    // Internal scanner state.

    const std::string& source_;  // The full source text we are scanning.
                                  // Stored as a const ref to avoid copying
                                  // the (potentially large) source string.

    DiagnosticEngine& diag_;     // Where we push errors and warnings.

    std::size_t start_;    // Index of the FIRST character of the token we are
                           // currently building.  Reset at the start of each
                           // new token.

    std::size_t current_;  // Index of the character we are about to examine
                           // next (the "read head").  Advances as we scan.

    int line_;    // 1-based line counter.  Incremented each time we consume '\n'.
    int column_;  // 1-based column counter within the current line.
                  // Reset to 1 after each '\n', incremented by advance().

    int tokenStartLine_;    // Line number when start_ was last set
    int tokenStartColumn_;  // Column of the FIRST character of the current token
                            // (recorded at the moment start_ is set).  We need
                            // to capture this because by the time we call
                            // makeToken() the column_ may have advanced past
                            // the start of the token.

    // Keyword lookup table.
    static const std::unordered_map<std::string, TokenType> keywords_;

    // Private scanning helpers.

    // Returns true when the read head is at end of input.
    bool isAtEnd() const;

    // Returns the current character without consuming it.
    char peek() const;

    // Returns the next character without consuming it.
    char peekNext() const;

    // Consumes and returns the current character.
    char advance();

    // Consumes the expected character when it matches.
    bool match(char expected);

    // Builds a Token from the current scanner state.
    Token makeToken(TokenType type);

    // Whitespace and comment skipping.

    // Skips whitespace and line comments.
    void skipWhitespaceAndComments();

    // Token scanners for identifiers, strings, and numbers.

    // Scans an identifier or keyword.
    Token scanIdentifierOrKeyword();

    // Scans a string literal.
    Token scanString();

    // Scans an integer or floating-point literal.
    Token scanNumber();

    // Character-classification helpers live in lexer.cpp.

};

} // namespace forml
