// =============================================================================
//  tests/test_parser.cpp
//  Forml Compiler — Stage 3: Manual Parser Test Driver
// =============================================================================
//
//  PURPOSE
//  -------
//  Reads each fixture file, runs the full lexer → parser pipeline, then
//  pretty-prints the resulting AST as an indented tree to stdout.  Also prints
//  any diagnostics collected.  No test framework — review by eye.
//
//  HOW TO BUILD (from forml-compiler/):
//    build_stage3.bat
//    (or: add -DTEST_PARSER to the g++ invocation and use test_parser.cpp)
//
//  HOW TO READ THE OUTPUT
//  ----------------------
//  Each line of the tree is:
//    [INDENT] NodeType: key=value ...
//  Indentation level shows depth in the AST.
//
// =============================================================================

#include "forml/lexer.hpp"
#include "forml/parser.hpp"
#include "forml/diagnostics.hpp"
#include "forml/ast.hpp"

#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

// ---------------------------------------------------------------------------
//  AST pretty-printer — a recursive depth-first tree walker
// ---------------------------------------------------------------------------
//  We use a simple recursive approach: each print function takes an indent
//  depth and prints itself + its children with depth+1.
//
//  Since Stage 5 (ASTVisitor) isn't built yet, we use direct downcast via
//  dynamic_cast.  This is intentionally temporary — Stage 5 will use proper
//  virtual dispatch and the Visitor pattern for all tree operations.
// ---------------------------------------------------------------------------

static std::string indent(int depth) {
    return std::string(static_cast<std::size_t>(depth) * 2, ' ');
}

// Forward declarations for mutual recursion
static void printNode(const forml::ASTNode* node, int depth);
static void printExpr(const forml::ExprNode* expr, int depth);
static void printCond(const forml::CondExprNode* cond, int depth);

static void printValue(const forml::ValueNode* v, int depth) {
    if (!v) { std::cout << indent(depth) << "(null value)\n"; return; }
    std::string kindStr;
    switch (v->valueKind) {
        case forml::ValueKind::StringLit:  kindStr = "string";     break;
        case forml::ValueKind::NumberLit:  kindStr = "number";     break;
        case forml::ValueKind::BoolTrue:   kindStr = "bool(true)"; break;
        case forml::ValueKind::BoolFalse:  kindStr = "bool(false)";break;
        case forml::ValueKind::Identifier: kindStr = "identifier"; break;
    }
    std::cout << indent(depth) << "Value(" << kindStr << "): \"" << v->text << "\"\n";
}

static void printExpr(const forml::ExprNode* expr, int depth) {
    if (!expr) { std::cout << indent(depth) << "(null expr)\n"; return; }
    if (auto* b = dynamic_cast<const forml::BinaryExprNode*>(expr)) {
        std::cout << indent(depth) << "BinaryExpr op=" << b->op << "\n";
        printExpr(b->left.get(),  depth+1);
        printExpr(b->right.get(), depth+1);
    } else if (auto* i = dynamic_cast<const forml::IdentifierExprNode*>(expr)) {
        std::cout << indent(depth) << "IdentifierExpr: " << i->name << "\n";
    } else if (auto* n = dynamic_cast<const forml::NumberLiteralNode*>(expr)) {
        std::cout << indent(depth) << "NumberLiteral: " << n->raw << "\n";
    } else {
        std::cout << indent(depth) << "(unknown expr)\n";
    }
}

static void printCond(const forml::CondExprNode* cond, int depth) {
    if (!cond) { std::cout << indent(depth) << "(null cond)\n"; return; }
    if (auto* b = dynamic_cast<const forml::BinaryCondNode*>(cond)) {
        std::cout << indent(depth) << "BinaryCond op=" << b->op << "\n";
        printCond(b->left.get(),  depth+1);
        printCond(b->right.get(), depth+1);
    } else if (auto* s = dynamic_cast<const forml::SimpleCondNode*>(cond)) {
        std::cout << indent(depth) << "SimpleCond: " << s->fieldName
                  << " " << s->comparator << "\n";
        printValue(s->value.get(), depth+1);
    } else {
        std::cout << indent(depth) << "(unknown cond)\n";
    }
}

static void printNode(const forml::ASTNode* node, int depth) {
    if (!node) return;

    switch (node->kind()) {
        case forml::NodeType::Form: {
            auto* n = static_cast<const forml::FormNode*>(node);
            std::cout << indent(depth) << "Form: \"" << n->name << "\"\n";
            for (auto& g : n->groupDefinitions) printNode(g.get(), depth+1);
            for (auto& v : n->varDeclarations)  printNode(v.get(), depth+1);
            for (auto& p : n->pages)            printNode(p.get(), depth+1);
            for (auto& s : n->statements)       printNode(s.get(), depth+1);
            if (n->actionBlock)                  printNode(n->actionBlock.get(), depth+1);
            break;
        }
        case forml::NodeType::Page: {
            auto* n = static_cast<const forml::PageNode*>(node);
            std::cout << indent(depth) << "Page: \"" << n->name << "\"\n";
            for (auto& s : n->statements)       printNode(s.get(), depth+1);
            if (n->triggerBlock)                 printNode(n->triggerBlock.get(), depth+1);
            break;
        }
        case forml::NodeType::GroupDefinition: {
            auto* n = static_cast<const forml::GroupDefinitionNode*>(node);
            std::cout << indent(depth) << "GroupDefinition: " << n->name << "\n";
            for (auto& f : n->fields)            printNode(f.get(), depth+1);
            break;
        }
        case forml::NodeType::GroupUse: {
            auto* n = static_cast<const forml::GroupUseNode*>(node);
            std::cout << indent(depth) << "GroupUse: " << n->groupName << "\n";
            break;
        }
        case forml::NodeType::VarDeclaration: {
            auto* n = static_cast<const forml::VarDeclarationNode*>(node);
            std::cout << indent(depth) << "VarDeclaration: " << n->name << " = ";
            if (n->value) std::cout << n->value->text;
            std::cout << "\n";
            break;
        }
        case forml::NodeType::Field: {
            auto* n = static_cast<const forml::FieldNode*>(node);
            std::cout << indent(depth) << "Field: " << n->name
                      << " type=" << forml::fieldTypeToString(n->fieldType) << "\n";
            for (auto& opt : n->options)
                std::cout << indent(depth+1) << "option: \"" << opt << "\"\n";
            if (n->source) printNode(n->source.get(), depth+1);
            if (n->uiBlock) {
                std::cout << indent(depth+1) << "UIBlock:\n";
                auto& u = *n->uiBlock;
                if (u.label)       std::cout << indent(depth+2) << "label: \"" << *u.label << "\"\n";
                if (u.placeholder) std::cout << indent(depth+2) << "placeholder: \"" << *u.placeholder << "\"\n";
                if (u.helpText)    std::cout << indent(depth+2) << "helpText: \"" << *u.helpText << "\"\n";
                if (u.bind)        std::cout << indent(depth+2) << "bind: \"" << *u.bind << "\"\n";
                if (u.defaultValue)
                    printValue(u.defaultValue->get(), depth+2);
            }
            if (n->validationBlock) {
                std::cout << indent(depth+1) << "ValidationBlock:\n";
                auto& v = *n->validationBlock;
                if (v.required)   std::cout << indent(depth+2) << "required\n";
                if (v.min)        std::cout << indent(depth+2) << "min: " << *v.min << "\n";
                if (v.max)        std::cout << indent(depth+2) << "max: " << *v.max << "\n";
                if (v.minLength)  std::cout << indent(depth+2) << "minLength: " << *v.minLength << "\n";
                if (v.maxLength)  std::cout << indent(depth+2) << "maxLength: " << *v.maxLength << "\n";
                if (v.pattern)    std::cout << indent(depth+2) << "pattern: \"" << *v.pattern << "\"\n";
            }
            if (n->computeBlock) {
                std::cout << indent(depth+1) << "ComputeBlock:\n";
                printExpr(n->computeBlock->expr.get(), depth+2);
            }
            if (n->triggerBlock) printNode(n->triggerBlock.get(), depth+1);
            break;
        }
        case forml::NodeType::Section: {
            auto* n = static_cast<const forml::SectionNode*>(node);
            std::cout << indent(depth) << "Section: \"" << n->name << "\"\n";
            for (auto& s : n->statements) printNode(s.get(), depth+1);
            break;
        }
        case forml::NodeType::Layout: {
            auto* n = static_cast<const forml::LayoutNode*>(node);
            std::cout << indent(depth) << "Layout: "
                      << (n->layoutKind == forml::LayoutKind::Row ? "row" : "column") << "\n";
            for (auto& s : n->statements) printNode(s.get(), depth+1);
            break;
        }
        case forml::NodeType::RepeatGroup: {
            auto* n = static_cast<const forml::RepeatGroupNode*>(node);
            std::cout << indent(depth) << "RepeatGroup: count=" << n->countRef << "\n";
            for (auto& f : n->fields) printNode(f.get(), depth+1);
            break;
        }
        case forml::NodeType::Conditional: {
            auto* n = static_cast<const forml::ConditionalNode*>(node);
            std::cout << indent(depth) << "Conditional:\n";
            std::cout << indent(depth+1) << "condition:\n";
            printCond(n->condition.get(), depth+2);
            std::cout << indent(depth+1) << "then:\n";
            for (auto& s : n->thenStatements) printNode(s.get(), depth+2);
            if (!n->elseStatements.empty()) {
                std::cout << indent(depth+1) << "else:\n";
                for (auto& s : n->elseStatements) printNode(s.get(), depth+2);
            }
            break;
        }
        case forml::NodeType::TriggerBlock: {
            auto* n = static_cast<const forml::TriggerBlockNode*>(node);
            std::string evStr;
            switch (n->eventType) {
                case forml::EventType::Load:   evStr = "load"; break;
                case forml::EventType::Change: evStr = "change"; break;
                case forml::EventType::Blur:   evStr = "blur"; break;
                case forml::EventType::Submit: evStr = "submit"; break;
            }
            std::cout << indent(depth) << "TriggerBlock: on " << evStr << "\n";
            for (auto& a : n->actions) printNode(a.get(), depth+1);
            break;
        }
        case forml::NodeType::ActionStatement: {
            auto* n = static_cast<const forml::ActionStatementNode*>(node);
            std::string ak;
            switch (n->actionKind) {
                case forml::ActionKind::Hide:     ak = "hide";     break;
                case forml::ActionKind::Show:     ak = "show";     break;
                case forml::ActionKind::Clear:    ak = "clear";    break;
                case forml::ActionKind::Set:      ak = "set";      break;
                case forml::ActionKind::Navigate: ak = "navigate"; break;
                case forml::ActionKind::Submit:   ak = "submit";   break;
            }
            std::cout << indent(depth) << "ActionStatement: " << ak;
            if (!n->target.empty()) std::cout << "(" << n->target << ")";
            std::cout << "\n";
            if (n->setValue) printValue(n->setValue.get(), depth+1);
            break;
        }
        case forml::NodeType::ActionBlock: {
            auto* n = static_cast<const forml::ActionBlockNode*>(node);
            std::string mstr;
            switch (n->method) {
                case forml::HttpMethod::Post:  mstr = "POST";  break;
                case forml::HttpMethod::Put:   mstr = "PUT";   break;
                case forml::HttpMethod::Patch: mstr = "PATCH"; break;
            }
            std::cout << indent(depth) << "ActionBlock: method=" << mstr
                      << " endpoint=\"" << n->endpoint << "\"\n";
            break;
        }
        case forml::NodeType::SourceBlock: {
            auto* n = static_cast<const forml::SourceBlockNode*>(node);
            std::cout << indent(depth) << "SourceBlock: "
                      << (n->sourceKind == forml::SourceKind::Url ? "url" : "var")
                      << "=\"" << n->source << "\"\n";
            if (n->mapLabel)
                std::cout << indent(depth+1) << "map: label=" << *n->mapLabel
                          << " value=" << *n->mapValue << "\n";
            break;
        }
        default:
            std::cout << indent(depth) << "(" << forml::nodeTypeToString(node->kind()) << ")\n";
            break;
    }
}

// ---------------------------------------------------------------------------
//  runFixture — lex → parse → pretty-print one .forml file
// ---------------------------------------------------------------------------

static void runFixture(const std::string& path) {
    std::cout << "\n";
    std::cout << "=============================================================\n";
    std::cout << " FIXTURE: " << path << "\n";
    std::cout << "=============================================================\n";

    // Read file
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cerr << "(could not open file — skipping)\n";
        return;
    }
    std::ostringstream ss;
    ss << file.rdbuf();
    std::string source = ss.str();

    // Lex
    forml::DiagnosticEngine diag;
    forml::Lexer lexer(source, diag);
    auto tokens = lexer.tokenize();

    if (diag.hasErrors()) {
        std::cout << "── Lexer Diagnostics ──\n";
        diag.printAll(std::cout);
        std::cout << "(skipping parse due to lex errors)\n";
        return;
    }

    // Parse
    forml::Parser parser(tokens, diag);
    auto ast = parser.parse();

    // Print AST
    std::cout << "\n── AST ──────────────────────────────────────────────────────\n";
    if (ast) {
        printNode(ast.get(), 0);
    } else {
        std::cout << "(parse returned null — likely a fatal structural error)\n";
    }

    // Print diagnostics
    if (diag.count() == 0) {
        std::cout << "\n── Diagnostics: none ✓\n";
    } else {
        std::cout << "\n── Diagnostics (" << diag.count() << ") "
                  << (diag.hasErrors() ? "[HAS ERRORS]" : "[warnings only]")
                  << " ──\n";
        diag.printAll(std::cout);
    }
}

// ---------------------------------------------------------------------------
//  main
// ---------------------------------------------------------------------------

int main() {
    std::cout << "============================================================\n";
    std::cout << "  Forml Parser — Stage 3 Test Driver\n";
    std::cout << "============================================================\n";

    const std::vector<std::string> fixtures = {
        "../tests/fixtures/01_strings_and_numbers.forml",
        "../tests/fixtures/02_nested_braces.forml",
        "../tests/fixtures/03_bad_characters.forml",
        "../tests/fixtures/04_soft_keyword_names.forml",
        "../tests/fixtures/05_deep_nesting.forml",
        "../tests/fixtures/06_malformed.forml",
        "../tests/fixtures/07_duplicate_field.forml",
        "../tests/fixtures/08_undefined_reference.forml",
        "../tests/fixtures/09_var_with_identifier.forml",
        "../tests/fixtures/10_validation_type_mismatch.forml",
        "../tests/fixtures/11_malformed_expression.forml",
    };

    for (const auto& path : fixtures) {
        runFixture(path);
    }

    std::cout << "\n============================================================\n";
    std::cout << "  Done. Review AST trees above for correctness.\n";
    std::cout << "============================================================\n";
    return 0;
}
