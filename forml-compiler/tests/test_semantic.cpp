#include "forml/lexer.hpp"
#include "forml/parser.hpp"
#include "forml/semantic_analyzer.hpp"
#include "forml/diagnostics.hpp"

#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cerr << "[test_semantic] WARNING: Could not open file: " << path << '\n';
        return {};
    }
    std::ostringstream ss;
    ss << file.rdbuf();
    return ss.str();
}

static void runFixture(const std::string& path) {
    std::cout << "\n=============================================================\n";
    std::cout << " FIXTURE: " << path << "\n";
    std::cout << "=============================================================\n";

    const std::string source = readFile(path);
    if (source.empty()) {
        std::cout << "(file empty or could not be read — skipping)\n";
        return;
    }

    forml::DiagnosticEngine diag;
    forml::Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();

    if (diag.hasErrors()) {
        std::cout << "── Lexer Diagnostics ──\n";
        diag.printAll(std::cout);
        std::cout << "(skipping parse and semantic analysis due to lex errors)\n";
        return;
    }

    forml::Parser parser(tokens, diag);
    auto ast = parser.parse();
    if (diag.hasErrors() || !ast) {
        std::cout << "── Parser Diagnostics ──\n";
        diag.printAll(std::cout);
        std::cout << "(skipping semantic analysis due to parse errors)\n";
        return;
    }

    forml::SemanticAnalyzer analyzer(*ast, diag);
    analyzer.analyze();

    if (diag.count() == 0) {
        std::cout << "── Semantic Diagnostics: none ✓\n";
    } else {
        std::cout << "── Semantic Diagnostics (" << diag.count() << ") "
                  << (diag.hasErrors() ? "[HAS ERRORS]" : "[warnings only]")
                  << " ──\n";
        diag.printAll(std::cout);
    }
}

int main() {
    std::cout << "============================================================\n";
    std::cout << "  Forml Semantic Analyzer — Stage 4 Test Driver\n";
    std::cout << "============================================================\n";

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
        "../tests/fixtures/11_malformed_expression.forml",
    };

    for (const auto& path : fixtures) {
        runFixture(path);
    }

    std::cout << "\n============================================================\n";
    std::cout << "  Done. Review diagnostics above for correctness.\n";
    std::cout << "============================================================\n";
    return 0;
}
