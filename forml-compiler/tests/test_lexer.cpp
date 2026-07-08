// =============================================================================
//  tests/test_lexer.cpp
//  Forml Compiler — Stage 1: Manual Lexer Test Driver
// =============================================================================
//
//  PURPOSE
//  -------
//  This is NOT a unit test framework (no Catch2, no GoogleTest).
//  It is a simple main() that:
//    1. Reads every .forml fixture file from tests/fixtures/
//    2. Runs each through Lexer::tokenize()
//    3. Pretty-prints the resulting token stream as a table
//    4. Prints any diagnostics collected
//
//  WHY no test framework?
//  At this stage we are REVIEWING the lexer output by eye — checking that
//  every character in the fixture produces the token we expect.  A formal
//  framework forces you to pre-specify expected outputs, which is premature
//  when you're still calibrating the lexer's behaviour.  Once we're confident
//  the lexer is correct, Stage 3+ tests can use a real framework.
//
//  HOW TO BUILD AND RUN (see CMakeLists.txt for the build command):
//    mkdir build && cd build
//    cmake .. -G "Ninja"          (or "MinGW Makefiles" on Windows)
//    cmake --build .
//    ./test_lexer
//
// =============================================================================

#include "forml/lexer.hpp"
#include "forml/diagnostics.hpp"
#include "forml/token.hpp"

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <iomanip>   // std::setw, std::left — for column alignment

// ---------------------------------------------------------------------------
//  readFile
// ---------------------------------------------------------------------------
//  Reads the entire content of a file into a std::string.
//  Returns an empty string and prints a warning if the file cannot be opened.
//  (We do not use exceptions — keeps the error path simple and visible.)
// ---------------------------------------------------------------------------

static std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cerr << "[test_lexer] WARNING: Could not open file: " << path << '\n';
        return {};
    }
    // Read the entire file into a stringstream, then return its string content.
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}


// ---------------------------------------------------------------------------
//  printTokenTable
// ---------------------------------------------------------------------------
//  Prints a human-readable table of tokens for one source file.
//
//  Column layout:
//    LINE  COL   TOKEN_TYPE            LEXEME
//    ----  ----  --------------------  --------------------------
//    1     1     KW_FORM               form
//    1     6     STRING                "User Registration"
//    ...
//
//  We use std::setw for fixed-width columns so the table lines up nicely
//  even when token type names have different lengths.
// ---------------------------------------------------------------------------

static void printTokenTable(const std::vector<forml::Token>& tokens) {
    // Column widths
    constexpr int COL_LINE   =  4;
    constexpr int COL_COL    =  4;
    constexpr int COL_TYPE   = 22;
    // Lexeme column is last — no fixed width needed, it just extends to the right.

    // ── Header ────────────────────────────────────────────────────────────────
    std::cout << std::left
              << std::setw(COL_LINE) << "LINE" << "  "
              << std::setw(COL_COL)  << "COL"  << "  "
              << std::setw(COL_TYPE) << "TOKEN_TYPE"  << "  "
              << "LEXEME"
              << '\n';

    // Separator line (dashes under each column)
    std::cout << std::string(COL_LINE, '-') << "  "
              << std::string(COL_COL,  '-') << "  "
              << std::string(COL_TYPE, '-') << "  "
              << std::string(26, '-')
              << '\n';

    // ── Rows ──────────────────────────────────────────────────────────────────
    for (const auto& tok : tokens) {
        // Make the lexeme printable: replace actual newlines with the literal
        // string "\n" so the table stays on one line.
        std::string displayLexeme = tok.lexeme;
        for (auto& ch : displayLexeme) {
            if (ch == '\n') ch = ' ';
        }
        // Truncate very long lexemes (e.g. URLs in strings) so the table stays
        // readable.  40 chars is a comfortable limit.
        if (displayLexeme.size() > 40) {
            displayLexeme = displayLexeme.substr(0, 37) + "...";
        }

        std::cout << std::left
                  << std::setw(COL_LINE) << tok.line    << "  "
                  << std::setw(COL_COL)  << tok.column  << "  "
                  << std::setw(COL_TYPE) << forml::tokenTypeToString(tok.type) << "  "
                  << displayLexeme
                  << '\n';
    }
}


// ---------------------------------------------------------------------------
//  runFixture
// ---------------------------------------------------------------------------
//  Runs the lexer on one fixture file and prints the results.
// ---------------------------------------------------------------------------

static void runFixture(const std::string& path) {
    // ── Banner ────────────────────────────────────────────────────────────────
    std::cout << "\n";
    std::cout << "=============================================================\n";
    std::cout << " FIXTURE: " << path << "\n";
    std::cout << "=============================================================\n";

    // ── Read source ───────────────────────────────────────────────────────────
    std::string source = readFile(path);
    if (source.empty()) {
        std::cout << "(file empty or could not be read — skipping)\n";
        return;
    }

    // Print the raw source so we can correlate it with the token table.
    std::cout << "\n── Source ──────────────────────────────────────────────────\n";
    std::cout << source;
    if (!source.empty() && source.back() != '\n') std::cout << '\n';

    // ── Lex ───────────────────────────────────────────────────────────────────
    forml::DiagnosticEngine diag;
    forml::Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();

    // ── Token table ───────────────────────────────────────────────────────────
    std::cout << "\n── Tokens (" << tokens.size() << ") ──────────────────────────────────────────\n";
    printTokenTable(tokens);

    // ── Diagnostics ───────────────────────────────────────────────────────────
    if (diag.count() == 0) {
        std::cout << "\n── Diagnostics: none ✓\n";
    } else {
        std::cout << "\n── Diagnostics (" << diag.count() << ") "
                  << (diag.hasErrors() ? "[HAS ERRORS]" : "[warnings only]")
                  << " ──────────────────────────────\n";
        diag.printAll(std::cout);
    }
}


// ---------------------------------------------------------------------------
//  main
// ---------------------------------------------------------------------------
//  Enumerates the fixture files and runs the lexer on each.
//
//  WHY hard-code the fixture paths?
//  For a first-pass review tool, hard-coded paths are fine — the files are
//  known, fixed, and co-located with this test file.  A later integration
//  test harness can discover files dynamically if needed.
//
//  Paths are relative to wherever the executable is run from.
//  The CMakeLists.txt places the executable in the build/ directory.
//  Run from the repository root:  ./build/test_lexer
//  Or from build/:                 ./test_lexer  (with relative paths adjusted)
//
//  We use paths relative to the project root (where CMakeLists.txt lives).
// ---------------------------------------------------------------------------

int main() {
    std::cout << "============================================================\n";
    std::cout << "  Forml Lexer — Stage 1 Test Driver\n";
    std::cout << "  Run every fixture through the lexer and print token tables\n";
    std::cout << "============================================================\n";

    // List of fixture files to test.
    // Add new fixtures here as you create them.
    const std::vector<std::string> fixtures = {
        "../tests/fixtures/01_strings_and_numbers.forml",
        "../tests/fixtures/02_nested_braces.forml",
        "../tests/fixtures/03_bad_characters.forml",
        "../tests/fixtures/04_soft_keyword_names.forml",
        "../tests/fixtures/05_deep_nesting.forml",
        "../tests/fixtures/06_malformed.forml",
        "../tests/fixtures/07_duplicate_field.forml",
        "../tests/fixtures/08_undefined_reference.forml",
        "../tests/fixtures/09_var_with_identifier.forml",
        "../tests/fixtures/10_validation_type_mismatch.forml",
    };

    for (const auto& path : fixtures) {
        runFixture(path);
    }

    std::cout << "\n============================================================\n";
    std::cout << "  Done. Review the tables above for correctness.\n";
    std::cout << "============================================================\n";

    return 0;
}
