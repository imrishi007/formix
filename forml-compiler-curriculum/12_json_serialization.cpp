// =============================================================================
// 12_json_serialization.cpp
// Forml Compiler Curriculum — File 12
//
// TOPIC: Using nlohmann/json to turn a validated Forml AST into a JSON
//        output file. Implementing a JsonVisitor using the visitor pattern
//        from file 10.
//
// COMPILE (requires nlohmann/json header):
//   Option A — single-header download:
//     curl -O https://raw.githubusercontent.com/nlohmann/json/develop/single_include/nlohmann/json.hpp
//     g++ -std=c++17 -Wall -o 12_json 12_json_serialization.cpp
//
//   Option B — package manager:
//     vcpkg install nlohmann-json  (Windows)
//     apt install nlohmann-json3-dev  (Ubuntu)
//
// RUN: ./12_json
//
// ⚠️  STATUS: SCAFFOLD — JSON schema depends on YOUR Forml node types.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. nlohmann/json basics:
//       nlohmann::json is a C++ library that lets you build JSON values
//       using C++ syntax that looks almost like JSON itself:
//
//         json obj;
//         obj["type"] = "page";
//         obj["label"] = "Sign Up";
//         obj["fields"] = json::array();
//         obj["fields"].push_back({{"name","age"}, {"type","number"}});
//
//  2. The JsonVisitor pattern:
//       Each visit() method builds a json object and pushes it into a
//       result stack. Parent nodes pop their children's json off the stack
//       and embed it in their own object.
//
//  3. YOUR Forml JSON output schema:
//       [PLACEHOLDER: After you paste your grammar, we'll design the exact
//        JSON schema that matches Forml's semantics. Example:
//
//        {
//          "type": "program",
//          "pages": [
//            {
//              "type": "page",
//              "label": "Sign Up",
//              "declarations": [
//                { "type": "field", "name": "username", "fieldType": "text",
//                  "constraints": { "required": true } },
//                { "type": "field", "name": "age", "fieldType": "number",
//                  "constraints": { "min": 18 } },
//                { "type": "computed", "name": "fullAge",
//                  "expression": { "op": "+", "left": "age", "right": 1 } }
//              ]
//            }
//          ]
//        }
//       ]
//
// =============================================================================

// Check if nlohmann/json is available — if not, show instructions and exit
#if __has_include(<nlohmann/json.hpp>)
    #include <nlohmann/json.hpp>
    #define HAS_JSON 1
#elif __has_include("json.hpp")
    #include "json.hpp"
    #define HAS_JSON 1
#else
    #define HAS_JSON 0
#endif

#include <iostream>
#include <string>
#include <vector>
#include <memory>

#if HAS_JSON
using json = nlohmann::json;

// =============================================================================
// SECTION 1 — nlohmann/json crash course
// =============================================================================

void jsonCrashCourse() {
    std::cout << "=== nlohmann/json crash course ===\n\n";

    // Building JSON objects
    json field;
    field["type"]      = "field";
    field["name"]      = "age";
    field["fieldType"] = "number";
    field["required"]  = true;
    field["constraints"] = {{"min", 18}, {"max", 120}};

    // Building JSON arrays
    json page;
    page["type"]  = "page";
    page["label"] = "Sign Up";
    page["declarations"] = json::array();
    page["declarations"].push_back(field);

    // Serialise to formatted string
    std::cout << page.dump(2) << "\n\n";  // 2-space indentation

    // Parsing JSON back
    json parsed = json::parse(R"({"name": "test", "value": 42})");
    std::cout << "Parsed name: " << parsed["name"].get<std::string>() << "\n";
    std::cout << "Parsed value: " << parsed["value"].get<int>() << "\n\n";
}

// =============================================================================
// SECTION 2 — JsonVisitor skeleton
// =============================================================================
//
//  [PLACEHOLDER: This will be a concrete Visitor that produces json output.
//
//  The "result stack" pattern:
//    Each visit() method:
//      1. Visit children (they push their json onto the stack)
//      2. Pop children's json off the stack
//      3. Build this node's json, embedding children's json
//      4. Push this node's json onto the stack
//
//  At the end, the stack has exactly one element: the root json object.]
//
//  Example structure:
//
//  class JsonVisitor : public Visitor {
//      std::stack<json> stack_;
//  public:
//      json result() { return stack_.top(); }
//
//      void visit(PageNode& node) override {
//          json obj;
//          obj["type"] = "page";
//          obj["label"] = node.label;
//          obj["declarations"] = json::array();
//
//          for (auto& child : node.children) {
//              child->accept(*this);            // child pushes its json
//              obj["declarations"].push_back(stack_.top());
//              stack_.pop();
//          }
//
//          stack_.push(obj);
//      }
//
//      void visit(FieldNode& node) override {
//          json obj;
//          obj["type"]      = "field";
//          obj["name"]      = node.name;
//          obj["fieldType"] = node.typeName;
//          stack_.push(obj);
//      }
//  };

int main() {
    std::cout << "File 12 — JSON Serialisation\n\n";
    jsonCrashCourse();
    std::cout << "[JsonVisitor for Forml nodes will be added from your grammar.]\n";
    return 0;
}

#else // !HAS_JSON

int main() {
    std::cerr << "nlohmann/json not found. To install:\n\n";
    std::cerr << "  Option 1 (single header, easiest):\n";
    std::cerr << "    curl -O https://raw.githubusercontent.com/nlohmann/json/develop/"
                 "single_include/nlohmann/json.hpp\n";
    std::cerr << "    Place json.hpp in the same directory as this file.\n\n";
    std::cerr << "  Option 2 (vcpkg, Windows):\n";
    std::cerr << "    vcpkg install nlohmann-json\n";
    std::cerr << "    g++ -std=c++17 ... -I$(vcpkg_root)/installed/x64-windows/include\n\n";
    std::cerr << "  Option 3 (apt, Ubuntu/WSL):\n";
    std::cerr << "    sudo apt install nlohmann-json3-dev\n";
    return 1;
}

#endif
