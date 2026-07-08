// src/diagnostics.cpp - DiagnosticEngine implementation.

#include "forml/diagnostics.hpp"

#include <iostream>   // for std::ostream (used in printAll)
#include <algorithm>  // for std::any_of

namespace forml {

void DiagnosticEngine::report(Severity severity,
                               const std::string& message,
                               int line,
                               int column)
{
    // Aggregate initialization: fill every field of the Diagnostic struct.
    diagnostics_.push_back(Diagnostic{ severity, message, line, column });
}

void DiagnosticEngine::error(const std::string& message, int line, int column) {
    report(Severity::Error, message, line, column);
}

void DiagnosticEngine::warning(const std::string& message, int line, int column) {
    report(Severity::Warning, message, line, column);
}

bool DiagnosticEngine::hasErrors() const {
    return std::any_of(diagnostics_.begin(), diagnostics_.end(),
        [](const Diagnostic& d) {
            return d.severity == Severity::Error;
        });
}

bool DiagnosticEngine::hasWarnings() const {
    return std::any_of(diagnostics_.begin(), diagnostics_.end(),
        [](const Diagnostic& d) {
            return d.severity == Severity::Warning;
        });
}

std::size_t DiagnosticEngine::count() const {
    return diagnostics_.size();
}

void DiagnosticEngine::printAll(std::ostream& out) const {
    for (const auto& d : diagnostics_) {

        if (d.severity == Severity::Error) {
            out << "[Error]   ";
        } else {
            out << "[Warning] ";
        }

        if (d.line > 0 && d.column > 0) {
            out << "Line " << d.line << ", Col " << d.column << ": ";
        } else if (d.line > 0) {
            out << "Line " << d.line << ": ";
        }

        out << d.message << '\n';
    }
}

const std::vector<Diagnostic>& DiagnosticEngine::diagnostics() const {
    return diagnostics_;
}

void DiagnosticEngine::clear() {
    diagnostics_.clear();
}

} // namespace forml
