// include/forml/diagnostics.hpp - diagnostic collection for compiler stages.

#pragma once

#include <string>
#include <vector>
#include <ostream>  // for std::ostream in printAll

namespace forml {

// Severity marks diagnostics as warnings or errors.

enum class Severity {
    Warning,
    Error
};


// Diagnostic stores one reported problem and its location.

struct Diagnostic {
    Severity    severity;
    std::string message;
    int         line;    // 1-based; 0 means "location unknown"
    int         column;  // 1-based; 0 means "location unknown"
};


// DiagnosticEngine collects diagnostics for a compile run.

class DiagnosticEngine {
public:
    DiagnosticEngine() = default;

    // -------------------------------------------------------------------------
    //  report
    // -------------------------------------------------------------------------
    //  Push one diagnostic onto the collection.
    //  Called by the Lexer, Parser, and Semantic Analyzer whenever they detect
    //  a problem.  The caller continues after this call — we don't throw.
    // -------------------------------------------------------------------------
    void report(Severity severity, const std::string& message, int line, int column);

    // Convenience overload: report an Error (the common case)
    void error(const std::string& message, int line, int column);

    // Convenience overload: report a Warning
    void warning(const std::string& message, int line, int column);

    // -------------------------------------------------------------------------
    //  hasErrors
    // -------------------------------------------------------------------------
    //  Returns true if ANY diagnostic with Severity::Error has been reported.
    //  The compiler pipeline uses this to decide whether to proceed to the
    //  next stage (e.g. don't attempt parsing if the lexer logged errors).
    //
    //  Warnings alone do NOT cause hasErrors() to return true.
    // -------------------------------------------------------------------------
    bool hasErrors() const;

    // -------------------------------------------------------------------------
    //  hasWarnings
    // -------------------------------------------------------------------------
    //  Returns true if any Warning was reported.
    // -------------------------------------------------------------------------
    bool hasWarnings() const;

    // -------------------------------------------------------------------------
    //  count
    // -------------------------------------------------------------------------
    //  Total number of diagnostics (errors + warnings).
    // -------------------------------------------------------------------------
    std::size_t count() const;

    // -------------------------------------------------------------------------
    //  printAll
    // -------------------------------------------------------------------------
    //  Writes every diagnostic to the given output stream in the format:
    //    [Error]   Line N, Col M: message
    //    [Warning] Line N, Col M: message
    //
    //  Pass std::cerr in production code, std::cout in tests.
    // -------------------------------------------------------------------------
    void printAll(std::ostream& out) const;

    // -------------------------------------------------------------------------
    //  diagnostics (read access)
    // -------------------------------------------------------------------------
    //  Returns a const reference to the full collection, e.g. so the CLI can
    //  iterate and format them differently from printAll's default format.
    // -------------------------------------------------------------------------
    const std::vector<Diagnostic>& diagnostics() const;

    // -------------------------------------------------------------------------
    //  clear
    // -------------------------------------------------------------------------
    //  Resets the engine (useful in tests that reuse one engine across calls).
    // -------------------------------------------------------------------------
    void clear();

private:
    std::vector<Diagnostic> diagnostics_;  // all reported problems in order
};

} // namespace forml
