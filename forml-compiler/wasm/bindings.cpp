// wasm/bindings.cpp - Emscripten embind exports for the Forml compiler.

#include "forml/lexer.hpp"
#include "forml/parser.hpp"
#include "forml/semantic_analyzer.hpp"
#include "forml/json_serializer.hpp"
#include "forml/diagnostics.hpp"

#include "nlohmann/json.hpp"

#include <emscripten/bind.h>
#include <string>
#include <memory>

std::string compile_forml(std::string source) {
    forml::DiagnosticEngine diag;

    forml::Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();

    forml::Parser parser(tokens, diag);
    auto ast = parser.parse();

    if (ast) {
        forml::SemanticAnalyzer analyzer(*ast, diag);
        analyzer.analyze();
    }

    nlohmann::json astJson = nullptr;
    if (ast) {
        forml::JsonSerializer serializer;
        astJson = serializer.serialize(*ast);
    }

    nlohmann::json diagArray = nlohmann::json::array();
    for (const auto& diagnostic : diag.diagnostics()) {
        std::string severityStr = "info";
        if (diagnostic.severity == forml::Severity::Error) {
            severityStr = "error";
        } else if (diagnostic.severity == forml::Severity::Warning) {
            severityStr = "warning";
        }

        diagArray.push_back({
            {"line", diagnostic.line},
            {"col", diagnostic.column},
            {"severity", severityStr},
            {"message", diagnostic.message}
        });
    }

    nlohmann::json result = {
        {"ast", astJson},
        {"diagnostics", diagArray}
    };

    return result.dump();
}

EMSCRIPTEN_BINDINGS(forml_compiler_module) {
    emscripten::function("compileForml", &compile_forml);
}
