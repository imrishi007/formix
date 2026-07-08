// =============================================================================
// 13_putting_it_together.cpp
// Forml Compiler Curriculum — File 13
//
// TOPIC: End-to-end pipeline: Forml source string → tokens → AST →
//        semantic validation → JSON output. A mini compiler using a
//        deliberately small but REAL subset of your Forml grammar.
//
// COMPILE: g++ -std=c++17 -Wall -o 13_pipeline 13_putting_it_together.cpp
//          (add -I path/to/json if using nlohmann/json)
// RUN:     ./13_pipeline
//
// ⚠️  STATUS: SCAFFOLD — will be the complete mini-compiler once files
//              03-12 are filled in from your grammar.
//
// =============================================================================
//
// ── WHAT THIS FILE DOES ───────────────────────────────────────────────────────
//
//  This is the CAPSTONE file. It wires everything together in one place:
//
//    1. A hard-coded Forml source string (a realistic sample from your domain)
//
//    2. Lexer          : source → vector<Token>
//       Report all lexer errors and abort if any found.
//
//    3. Parser         : vector<Token> → AST (ProgramNode)
//       Report all parse errors and abort if any found.
//       (file 09's panic-mode recovery means we get ALL errors, not just the first)
//
//    4. SemanticValidator : AST → validated AST (or errors)
//       Report all semantic errors and abort if any found.
//
//    5. JsonVisitor    : AST → nlohmann::json → formatted JSON string
//       Print the JSON to stdout (or write to a file).
//
//  The ENTIRE compiler is ~30 lines of pipeline code. Everything else is in the
//  classes built across files 01-12.
//
//  That's the payoff: each subsystem is independently testable, independently
//  replaceable, and the main pipeline is just plumbing.
//
// ── THE SAMPLE FORML PROGRAM ─────────────────────────────────────────────────
//
//  [PLACEHOLDER: This will be a realistic Forml snippet covering:
//    - At least one page
//    - Several field types
//    - At least one group
//    - At least one conditional
//    - At least one computed field
//    - At least one action block
//
//   Written AFTER you paste your EBNF so it uses real Forml syntax.]
//
// ── THE EXPECTED JSON OUTPUT ─────────────────────────────────────────────────
//
//  [PLACEHOLDER: The JSON output matching the sample program above,
//   showing that the full pipeline works correctly end-to-end.]
//
// =============================================================================

#include <iostream>
#include <string>

// =============================================================================
// SECTION 1 — Include all subsystems
// =============================================================================
//
//  In a real project these would be separate .h / .cpp translation units.
//  For the curriculum, files 01-12 are each standalone. In file 13 we'll
//  either:
//    a) #include the class definitions from each file (requires splitting
//       each file into a header + implementation), OR
//    b) Combine the final versions of all classes into this one file
//
//  Approach (b) is simpler for a learning project. We'll paste the final
//  Lexer, AST, Parser, Validator, and JsonVisitor here and connect them.
//
//  [PLACEHOLDER: All class definitions will be embedded here once complete.]

// =============================================================================
// SECTION 2 — The pipeline function
// =============================================================================

bool runPipeline(const std::string& source, bool verbose = true) {
    if (verbose) {
        std::cout << "=== Source ===\n" << source << "\n\n";
    }

    // STEP 1: Lex
    std::cout << "Step 1: Lexing...\n";
    // Lexer lexer(source);
    // auto tokens = lexer.tokenize();
    // if (lexer.hasErrors()) { ... report and return false ... }
    std::cout << "  [PLACEHOLDER — Lexer will be wired here]\n\n";

    // STEP 2: Parse
    std::cout << "Step 2: Parsing...\n";
    // Parser parser(tokens);
    // auto ast = parser.parse();
    // if (parser.hasErrors()) { ... report and return false ... }
    std::cout << "  [PLACEHOLDER — Parser will be wired here]\n\n";

    // STEP 3: Semantic validation
    std::cout << "Step 3: Validating semantics...\n";
    // SemanticValidator validator;
    // validator.validate(*ast);
    // if (validator.hasErrors()) { ... report and return false ... }
    std::cout << "  [PLACEHOLDER — Validator will be wired here]\n\n";

    // STEP 4: JSON serialisation
    std::cout << "Step 4: Serialising to JSON...\n";
    // JsonVisitor jsonVisitor;
    // ast->accept(jsonVisitor);
    // std::cout << jsonVisitor.result().dump(2) << "\n";
    std::cout << "  [PLACEHOLDER — JsonVisitor will be wired here]\n\n";

    return true;
}

// =============================================================================
// SECTION 3 — main()
// =============================================================================

int main() {
    std::cout << "File 13 — Full Forml Compiler Pipeline\n";
    std::cout << "========================================\n\n";

    // Sample Forml program — will be replaced with real Forml syntax
    const std::string sampleProgram = R"(
// [PLACEHOLDER: Real Forml source using YOUR grammar]
// page "Sign Up" {
//     field username: text (required)
//     field age: number (min: 18)
//     computed isAdult: age >= 18
//     if (isAdult) {
//         field consent: boolean (required)
//     }
// }
)";

    runPipeline(sampleProgram);

    std::cout << "=== Architecture Summary ===\n";
    std::cout << "Source\n";
    std::cout << "  └─▶ Lexer         → vector<Token>     (file 02)\n";
    std::cout << "        └─▶ Parser  → AST               (files 05-09)\n";
    std::cout << "              └─▶ SemanticValidator      (file 11)\n";
    std::cout << "                    └─▶ JsonVisitor → JSON (files 10, 12)\n\n";
    std::cout << "Each stage is independently testable and replaceable.\n";
    std::cout << "Adding a new output format = add one new Visitor class.\n";

    return 0;
}
