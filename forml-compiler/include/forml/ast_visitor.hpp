// include/forml/ast_visitor.hpp - Visitor interface for Forml AST nodes.

#pragma once

namespace forml {

class ValueNode;
class BinaryExprNode;
class IdentifierExprNode;
class NumberLiteralNode;
class BinaryCondNode;
class SimpleCondNode;
class SourceBlockNode;
class ComputeBlockNode;
class ActionStatementNode;
class TriggerBlockNode;
class ActionBlockNode;
class FieldNode;
class GroupDefinitionNode;
class GroupUseNode;
class VarDeclarationNode;
class SectionNode;
class LayoutNode;
class RepeatGroupNode;
class ConditionalNode;
class PageNode;
class FormNode;

// ASTVisitor defines double-dispatch hooks for each concrete AST node.
class ASTVisitor {
public:
    virtual ~ASTVisitor() = default;

    virtual void visit(ValueNode& node) = 0;
    virtual void visit(BinaryExprNode& node) = 0;
    virtual void visit(IdentifierExprNode& node) = 0;
    virtual void visit(NumberLiteralNode& node) = 0;
    virtual void visit(BinaryCondNode& node) = 0;
    virtual void visit(SimpleCondNode& node) = 0;
    virtual void visit(SourceBlockNode& node) = 0;
    virtual void visit(ComputeBlockNode& node) = 0;
    virtual void visit(ActionStatementNode& node) = 0;
    virtual void visit(TriggerBlockNode& node) = 0;
    virtual void visit(ActionBlockNode& node) = 0;
    virtual void visit(FieldNode& node) = 0;
    virtual void visit(GroupDefinitionNode& node) = 0;
    virtual void visit(GroupUseNode& node) = 0;
    virtual void visit(VarDeclarationNode& node) = 0;
    virtual void visit(SectionNode& node) = 0;
    virtual void visit(LayoutNode& node) = 0;
    virtual void visit(RepeatGroupNode& node) = 0;
    virtual void visit(ConditionalNode& node) = 0;
    virtual void visit(PageNode& node) = 0;
    virtual void visit(FormNode& node) = 0;
};

} // namespace forml
