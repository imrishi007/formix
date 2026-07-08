// src/forml_bridge.cpp - Compiler pipeline bridge implementation.

#include "forml/forml_bridge.hpp"

#include "forml/diagnostics.hpp"
#include "forml/json_serializer.hpp"
#include "forml/lexer.hpp"
#include "forml/parser.hpp"
#include "forml/semantic_analyzer.hpp"

#include "nlohmann/json.hpp"

namespace forml {

namespace {

std::string severityToString(Severity severity) {
    return severity == Severity::Error ? "error" : "warning";
}

nlohmann::json diagnosticsToJson(const DiagnosticEngine& diag) {
    nlohmann::json result = nlohmann::json::array();
    for (const auto& diagnostic : diag.diagnostics()) {
        result.push_back({
            {"severity", severityToString(diagnostic.severity)},
            {"message", diagnostic.message},
            {"line", diagnostic.line},
            {"column", diagnostic.column}
        });
    }
    return result;
}

} // namespace

std::string compileForml(const std::string& source) {
    DiagnosticEngine diag;

    Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();

    Parser parser(tokens, diag);
    auto ast = parser.parse();

    if (ast) {
        SemanticAnalyzer analyzer(*ast, diag);
        analyzer.analyze();
    }

    nlohmann::json astJson = nullptr;
    if (ast) {
        JsonSerializer serializer;
        astJson = serializer.serialize(*ast);
    }

    nlohmann::json result = {
        {"success", !diag.hasErrors()},
        {"ast", astJson},
        {"diagnostics", diagnosticsToJson(diag)}
    };

    return result.dump();
}

} // namespace forml
