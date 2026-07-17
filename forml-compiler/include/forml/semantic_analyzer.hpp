///// include/forml/semantic_analyzer.hpp — Forml Stage 4: Semantic Analyzer declaration.
// Walks the AST produced by the Parser and enforces semantic rules.
// Direct tree-walker (visitX calls); does NOT use ASTVisitor (Stage 5).

#pragma once

#include "forml/ast.hpp"
#include "forml/diagnostics.hpp"

#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace forml {

// ── Scope ─────────────────────────────────────────────────────────────────────
// Tracks named declarations visible at one level of the statement hierarchy.
// The analyzer pushes a new Scope when entering a page, section, group, or
// layout/conditional body, and pops it on exit.
struct Scope {
    // field name → FieldType (for type-compatibility checks)
    std::unordered_map<std::string, FieldType> fields;
    // var name → present (vars are form-level only, but stored here for lookup)
    std::unordered_set<std::string> vars;
};

// ── SemanticAnalyzer ──────────────────────────────────────────────────────────
class SemanticAnalyzer {
public:
    SemanticAnalyzer(FormNode& form, DiagnosticEngine& diag);

    // Runs all semantic checks. Results are reported into diag.
    void analyze();

private:
    FormNode&         form_;
    DiagnosticEngine& diag_;

    // Form-level name tables (populated during the first pass of analyze()).
    std::unordered_set<std::string> groupNames_;  // defined group names
    std::unordered_set<std::string> varNames_;    // defined var names
    std::unordered_set<std::string> pageNames_;   // defined page names

    // All declared field names visible from the current scope chain,
    // used for identifier resolution.  Key: field name, value: FieldType.
    std::unordered_map<std::string, FieldType> allFields_;

    // ── visitors ──────────────────────────────────────────────────────────────
    void visitForm(FormNode& node);
    void visitPage(PageNode& node);
    void visitGroupDefinition(GroupDefinitionNode& node,
                               std::unordered_set<std::string>& seenNames);
    void visitVarDeclaration(VarDeclarationNode& node,
                              std::unordered_set<std::string>& seenNames);
    void visitStatementList(NodeList& stmts,
                             std::unordered_set<std::string>& seenFieldNames);
    void visitStatement(ASTNode& node,
                         std::unordered_set<std::string>& seenFieldNames);
    void visitField(FieldNode& node,
                     std::unordered_set<std::string>& seenFieldNames);
    void visitSection(SectionNode& node,
                       std::unordered_set<std::string>& seenFieldNames);
    void visitLayout(LayoutNode& node,
                      std::unordered_set<std::string>& seenFieldNames);
    void visitRepeatGroup(RepeatGroupNode& node,
                           std::unordered_set<std::string>& seenFieldNames);
    void visitConditional(ConditionalNode& node,
                           std::unordered_set<std::string>& seenFieldNames);
    void visitGroupUse(GroupUseNode& node);

    // ── check helpers ─────────────────────────────────────────────────────────
    // Check 3: var rhs must be a literal (not an IDENTIFIER).
    void checkVarLiteralOnly(const VarDeclarationNode& node);

    // Check 4: min/max only valid on integer/float; minLength/maxLength/pattern
    //          only valid on text/email.
    void checkValidationTypeCompat(const FieldNode& field);

    // Check 2: verify an identifier resolves to a known field or var.
    void checkIdentifierRef(const std::string& name, int line, int col,
                             const std::string& context);

    // Check 5: repeat count= IDENTIFIER must resolve to a declared field/var.
    void checkRepeatCountRef(const RepeatGroupNode& node);

    // Walk a condition tree and check any IDENTIFIER leaves.
    void checkConditionRefs(const CondExprNode& cond);

    // Walk an expression tree and check any IDENTIFIER leaves.
    void checkExprRefs(const ExprNode& expr);

    // Convenience error helper.
    void error(const std::string& msg, int line, int col);
};

} // namespace forml
