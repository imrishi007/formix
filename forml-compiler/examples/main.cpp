// examples/main.cpp - Native CLI for the Forml compiler bridge.

#include "include/forml/forml_bridge.hpp"

#include <fstream>
#include <iostream>
#include <sstream>
#include <string>

namespace {

std::string readFile(const std::string& path, bool& ok) {
    std::ifstream file(path);
    if (!file.is_open()) {
        ok = false;
        return {};
    }

    std::ostringstream ss;
    ss << file.rdbuf();
    ok = true;
    return ss.str();
}

} // namespace

int main(int argc, char** argv) {
    if (argc != 2) {
        std::cerr << "Usage: forml_compiler <path-to-.forml-file>\n";
        return 1;
    }

    bool ok = false;
    const std::string source = readFile(argv[1], ok);
    if (!ok) {
        std::cerr << "Could not read file: " << argv[1] << '\n';
        return 1;
    }

    std::cout << forml::compileForml(source) << '\n';
    return 0;
}
