// include/forml/parser.hpp — Forml recursive descent parser declaration.
// One private method per EBNF production rule; one public entry point: parse().

#pragma once

#include "forml/token.hpp"
#include "forml/ast.hpp"
#include "forml/diagnostics.hpp"

#include <vector>
#include <memory>
#include <string>

namespace forml {

class Parser {
public:
    // Takes the full token stream from the Lexer (must end with END_OF_FILE)
    // and the shared DiagnosticEngine.
    Parser(const std::vector<Token>& tokens, DiagnosticEngine& diag);

    // Parse the entire stream and return the FormNode root, or nullptr if the
    // source doesn't start with "form". Partial errors are recorded in diag.
    std::unique_ptr<FormNode> parse();

private:
    const std::vector<Token>& tokens_;
    DiagnosticEngine&         diag_;
    std::size_t               current_;  // index of the next token to consume

    // ── token navigation ──────────────────────────────────────────────────────
    const Token& peek() const;
    const Token& peekAt(std::size_t offset) const;
    const Token& previous() const;
    bool         isAtEnd() const;
    const Token& advance();
    bool         check(TokenType type) const;
    bool         match(TokenType type);
    // Consume current token if it matches; otherwise report error and return
    // dummyToken_ without consuming (parse continues).
    const Token& expect(TokenType type, const std::string& errorMessage);

    // ── hard / soft keyword resolution ────────────────────────────────────────
    // Hard keywords (form, page, field, group, use, var, if, else, on, action,
    // compute, repeat, count) are never valid as user-defined names.
    // Soft keywords are valid names when in an IDENTIFIER position.
    static bool isHardKeyword(TokenType t);
    static bool isSoftKeyword(TokenType t);
    // Accepts IDENTIFIER or soft keyword; errors on hard keyword or other token.
    const Token& expectIdentifierLike();

    // ── error recovery ────────────────────────────────────────────────────────
    void error(const Token& tok, const std::string& message);
    // Panic-mode: advance past tokens until a '}' is consumed or a
    // statement-starting keyword is reached (without consuming it).
    void synchronize();

    // ── grammar rules (§N = EBNF section number in EBNF_grammar.md) ──────────
    // §2
    std::unique_ptr<FormNode>  parseForm();
    std::unique_ptr<PageNode>  parsePage();
    NodePtr                    parseStatement();

    // §3
    std::unique_ptr<GroupDefinitionNode> parseGroupDefinition();
    std::unique_ptr<GroupUseNode>        parseGroupUse();
    std::unique_ptr<VarDeclarationNode>  parseVarDeclaration();

    // §4
    std::unique_ptr<FieldNode>       parseField();
    FieldType                        parseType();
    void                             parseSelectOptions(FieldNode& field);
    std::unique_ptr<SourceBlockNode> parseSourceBlock();

    // §5
    std::optional<UIBlockNode>         parseUIBlock();
    std::optional<ValidationBlockNode> parseValidationBlock();
    std::unique_ptr<SectionNode>       parseSection();
    std::unique_ptr<LayoutNode>        parseLayoutBlock();

    // §6
    std::unique_ptr<ConditionalNode>  parseConditional();
    CondPtr                           parseCondition();
    CondPtr                           parseLogicTerm();
    CondPtr                           parseLogicFactor();
    std::unique_ptr<SimpleCondNode>   parseSimpleCondition();
    std::unique_ptr<ComputeBlockNode> parseComputeBlock();
    ExprPtr                           parseExpression();
    ExprPtr                           parseMathTerm();
    ExprPtr                           parseMathFactor();
    std::unique_ptr<RepeatGroupNode>  parseRepeatGroup();

    // §7
    std::unique_ptr<ActionBlockNode>     parseActionBlock();
    std::unique_ptr<TriggerBlockNode>    parseTriggerBlock();
    std::unique_ptr<ActionStatementNode> parseActionStatement();

    // primitives
    std::unique_ptr<ValueNode> parseValue();

    // Dummy token returned by expect() on mismatch so all callers get a valid ref.
    static const Token dummyToken_;
};

} // namespace forml
