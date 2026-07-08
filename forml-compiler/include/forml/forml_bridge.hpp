// include/forml/forml_bridge.hpp - Public bridge entry point for Forml compilation.

#pragma once

#include <string>

namespace forml {

// Compiles Forml source and returns a JSON result string.
std::string compileForml(const std::string& source);

} // namespace forml
