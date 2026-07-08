// =============================================================================
// 11_semantic_validation.cpp
// Forml Compiler Curriculum — File 11
//
// TOPIC: A second AST-walking pass that catches errors the parser CANNOT catch
//        (because they require knowing MORE than just token sequence).
//        Duplicate names, undefined references, type mismatches, etc.
//
// COMPILE: g++ -std=c++17 -Wall -o 11_semantic 11_semantic_validation.cpp
// RUN:     ./11_semantic
//
// ⚠️  STATUS: SCAFFOLD — validation rules come from YOUR Forml semantics.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  WHY a separate semantic pass?
//    The parser checks SYNTAX (valid token sequences).
//    But many errors require CONTEXT that the parser doesn't have:
//
//    Syntax is fine, but semantics are broken:
//      field age: number
//      field age: text    ← duplicate field name — parser sees two valid fields
//
//      computed total: price * qty   ← 'price' and 'qty' must be defined fields
//      (the parser doesn't know what names are in scope)
//
//      page "Checkout" {
//          group "Items" {}
//          group "Items" {}  ← duplicate group name within the page
//      }
//
//  WHAT the semantic pass checks for Forml:
//    [PLACEHOLDER: After you paste your grammar, this section will list
//     ALL the semantic rules specific to Forml:
//
//     1. Duplicate field/group/page names
//     2. Computed fields reference only defined fields
//     3. Conditional 'if' conditions reference only defined fields
//     4. Action block targets reference only defined fields
//     5. Field type names are from the allowed set (text, number, email, ...)
//     6. Numeric constraints: min <= max, min/max values are numbers
//     7. Required/optional are not both specified on the same field
//     8. Circular computed references: A depends on B depends on A]
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>

// =============================================================================
// SECTION 1 — Symbol Table
// =============================================================================
//
//  A symbol table maps NAMES to their DECLARATIONS.
//  It answers the question: "I see the name 'age' in an expression — is that
//  a valid field name, and if so, what type is it?"
//
//  For Forml, we need at minimum:
//    • A map from field name → field type (within a page/group scope)
//    • A set of page names (for cross-page reference checking)
//
//  We build the symbol table IN the semantic pass by walking the AST.
//
//  [PLACEHOLDER: The exact symbol table structure depends on your scoping
//   rules — are fields page-scoped? group-scoped? can pages reference each
//   other? These questions will be answered from your grammar.]

struct FieldInfo {
    std::string name;
    std::string typeName;
    int         line;
    int         col;
};

class SymbolTable {
public:
    // Declare a field. Returns false if the name is already declared.
    bool declare(const std::string& name, FieldInfo info) {
        if (fields_.count(name)) return false;  // duplicate
        fields_[name] = std::move(info);
        return true;
    }

    // Look up a field by name. Returns nullptr if not found.
    const FieldInfo* lookup(const std::string& name) const {
        auto it = fields_.find(name);
        return (it != fields_.end()) ? &it->second : nullptr;
    }

    const std::unordered_map<std::string, FieldInfo>& all() const { return fields_; }

private:
    std::unordered_map<std::string, FieldInfo> fields_;
};

// =============================================================================
// SECTION 2 — Semantic Validator (Visitor pattern from file 10)
// =============================================================================
//
//  [PLACEHOLDER: This will be a full Visitor subclass that:
//    1. Builds the symbol table in a first sub-pass (collect all declared names)
//    2. Checks all references against the symbol table in a second sub-pass
//    3. Checks semantic rules (no duplicates, valid types, etc.)
//
//  The two-sub-pass approach is important: in Forml, a computed field on line 3
//  might reference a field declared on line 7. A single-pass would flag this
//  as an undefined reference. Two passes (collect all, then check) handle it.]

class SemanticValidator {
public:
    // [PLACEHOLDER: will implement visit() for each Forml node type]

    bool validate(/*const ProgramNode& program*/) {
        // Phase 1: collect all declared names into symbol table
        // Phase 2: validate all references and constraints
        return errors_.empty();
    }

    const std::vector<std::string>& errors() const { return errors_; }

private:
    SymbolTable             symbolTable_;
    std::vector<std::string> errors_;

    void addError(int line, int col, const std::string& msg) {
        errors_.push_back("semantic error[" + std::to_string(line) + ":" +
                          std::to_string(col) + "]: " + msg);
    }
};

// =============================================================================
// SECTION 3 — Demo: showing the kinds of errors caught
// =============================================================================

int main() {
    std::cout << "File 11 — Semantic Validation\n\n";

    // Demonstrate the symbol table mechanism
    SymbolTable table;
    table.declare("name",  {"name",  "text",   3, 5});
    table.declare("age",   {"age",   "number", 4, 5});
    table.declare("email", {"email", "email",  5, 5});

    std::cout << "Symbol table contents:\n";
    for (const auto& [nm, info] : table.all()) {
        std::cout << "  " << nm << ": " << info.typeName
                  << " @ " << info.line << ":" << info.col << "\n";
    }

    // Simulate a duplicate declaration check
    bool ok = table.declare("age", {"age", "text", 8, 5}); // duplicate!
    if (!ok) {
        std::cout << "\nsemantic error[8:5]: duplicate field name 'age' "
                     "(first declared at 4:5)\n";
    }

    // Simulate a reference check
    std::string refName = "totalCost";
    if (!table.lookup(refName)) {
        std::cout << "semantic error[12:15]: reference to undefined field '" << refName << "'\n";
    }

    std::cout << "\n[Full semantic rules for Forml will be derived from your grammar.]\n";
    std::cout << "Key semantic checks to implement:\n";
    std::cout << "  - Duplicate field/group/page names\n";
    std::cout << "  - Computed field references must be declared\n";
    std::cout << "  - Conditional expression operands must be declared\n";
    std::cout << "  - Field types must be from the allowed set\n";
    std::cout << "  - Circular computed dependencies\n";
    return 0;
}
