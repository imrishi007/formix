// Debug test — just fixture 05
#include "forml/lexer.hpp"
#include "forml/parser.hpp"
#include "forml/diagnostics.hpp"
#include "forml/ast.hpp"
#include <iostream>
#include <fstream>
#include <sstream>

int main() {
    std::string path = "../tests/fixtures/05_deep_nesting.forml";
    std::ifstream file(path);
    if (!file.is_open()) { std::cerr << "Cannot open " << path << "\n"; return 1; }
    std::ostringstream ss; ss << file.rdbuf();
    std::string source = ss.str();

    forml::DiagnosticEngine diag;
    forml::Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();
    std::cout << "Lexed " << tokens.size() << " tokens\n" << std::flush;
    if (diag.hasErrors()) { std::cout << "Lex errors!\n" << std::flush; diag.printAll(std::cout); return 1; }

    std::cout << "Starting parse...\n" << std::flush;
    forml::Parser parser(tokens, diag);
    auto ast = parser.parse();
    std::cout << "Parse complete. ast=" << (ast ? "OK" : "null") << "\n" << std::flush;
    diag.printAll(std::cout);
    return 0;
}
