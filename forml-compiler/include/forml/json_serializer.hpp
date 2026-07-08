// include/forml/json_serializer.hpp - JSON serialization for Forml ASTs.

#pragma once

#include "forml/ast.hpp"
#include "forml/ast_visitor.hpp"

#include "nlohmann/json.hpp"

namespace forml {

// JsonSerializer converts a Forml AST into the frontend wire JSON shape.
class JsonSerializer : public ASTVisitor {
public:
    // Serializes the root form and returns a structured JSON object.
    nlohmann::json serialize(FormNode& form);

    void visit(ValueNode& node) override;
    void visit(BinaryExprNode& node) override;
    void visit(IdentifierExprNode& node) override;
    void visit(NumberLiteralNode& node) override;
    void visit(BinaryCondNode& node) override;
    void visit(SimpleCondNode& node) override;
    void visit(SourceBlockNode& node) override;
    void visit(ComputeBlockNode& node) override;
    void visit(ActionStatementNode& node) override;
    void visit(TriggerBlockNode& node) override;
    void visit(ActionBlockNode& node) override;
    void visit(FieldNode& node) override;
    void visit(GroupDefinitionNode& node) override;
    void visit(GroupUseNode& node) override;
    void visit(VarDeclarationNode& node) override;
    void visit(SectionNode& node) override;
    void visit(LayoutNode& node) override;
    void visit(RepeatGroupNode& node) override;
    void visit(ConditionalNode& node) override;
    void visit(PageNode& node) override;
    void visit(FormNode& node) override;

private:
    nlohmann::json current_;

    nlohmann::json serializeNode(ASTNode& node);
    nlohmann::json serializeValue(ValueNode* node);
    nlohmann::json serializeExpr(ExprNode* node);
    nlohmann::json serializeCond(CondExprNode* node);
    nlohmann::json serializeStatementList(NodeList& statements);
    nlohmann::json serializeFields(std::vector<std::unique_ptr<FieldNode>>& fields);
    nlohmann::json serializeUIBlock(const UIBlockNode& block);
    nlohmann::json serializeValidationBlock(const ValidationBlockNode& block);
};

} // namespace forml
