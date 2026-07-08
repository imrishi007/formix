// src/ast.cpp - AST helper implementations.

#include "forml/ast.hpp"
#include "forml/ast_visitor.hpp"

#include <stdexcept>

namespace forml {

std::string nodeTypeToString(NodeType kind) {
    switch (kind) {
        case NodeType::Form:            return "Form";
        case NodeType::Page:            return "Page";
        case NodeType::GroupDefinition: return "GroupDefinition";
        case NodeType::GroupUse:        return "GroupUse";
        case NodeType::VarDeclaration:  return "VarDeclaration";
        case NodeType::Field:           return "Field";
        case NodeType::Section:         return "Section";
        case NodeType::Layout:          return "Layout";
        case NodeType::RepeatGroup:     return "RepeatGroup";
        case NodeType::Conditional:     return "Conditional";
        case NodeType::UIBlock:         return "UIBlock";
        case NodeType::ValidationBlock: return "ValidationBlock";
        case NodeType::ComputeBlock:    return "ComputeBlock";
        case NodeType::TriggerBlock:    return "TriggerBlock";
        case NodeType::ActionStatement: return "ActionStatement";
        case NodeType::ActionBlock:     return "ActionBlock";
        case NodeType::SourceBlock:     return "SourceBlock";
        case NodeType::BinaryExpr:      return "BinaryExpr";
        case NodeType::IdentifierExpr:  return "IdentifierExpr";
        case NodeType::NumberLiteral:   return "NumberLiteral";
        case NodeType::BinaryCond:      return "BinaryCond";
        case NodeType::SimpleCond:      return "SimpleCond";
        case NodeType::Value:           return "Value";
        default:                        return "Unknown";
    }
}

std::string fieldTypeToString(FieldType t) {
    switch (t) {
        case FieldType::Text:     return "text";
        case FieldType::Integer:  return "integer";
        case FieldType::Float:    return "float";
        case FieldType::Email:    return "email";
        case FieldType::Date:     return "date";
        case FieldType::Boolean:  return "boolean";
        case FieldType::Url:      return "url";
        case FieldType::Select:   return "select";
        case FieldType::Radio:    return "radio";
        case FieldType::Checkbox: return "checkbox";
        default:                  return "unknown";
    }
}

void ValueNode::accept(ASTVisitor& v)           { v.visit(*this); }
void BinaryExprNode::accept(ASTVisitor& v)      { v.visit(*this); }
void IdentifierExprNode::accept(ASTVisitor& v)  { v.visit(*this); }
void NumberLiteralNode::accept(ASTVisitor& v)   { v.visit(*this); }
void BinaryCondNode::accept(ASTVisitor& v)      { v.visit(*this); }
void SimpleCondNode::accept(ASTVisitor& v)      { v.visit(*this); }
void SourceBlockNode::accept(ASTVisitor& v)     { v.visit(*this); }
void ComputeBlockNode::accept(ASTVisitor& v)    { v.visit(*this); }
void ActionStatementNode::accept(ASTVisitor& v) { v.visit(*this); }
void TriggerBlockNode::accept(ASTVisitor& v)    { v.visit(*this); }
void ActionBlockNode::accept(ASTVisitor& v)     { v.visit(*this); }
void FieldNode::accept(ASTVisitor& v)           { v.visit(*this); }
void GroupDefinitionNode::accept(ASTVisitor& v) { v.visit(*this); }
void GroupUseNode::accept(ASTVisitor& v)        { v.visit(*this); }
void VarDeclarationNode::accept(ASTVisitor& v)  { v.visit(*this); }
void SectionNode::accept(ASTVisitor& v)         { v.visit(*this); }
void LayoutNode::accept(ASTVisitor& v)          { v.visit(*this); }
void RepeatGroupNode::accept(ASTVisitor& v)     { v.visit(*this); }
void ConditionalNode::accept(ASTVisitor& v)     { v.visit(*this); }
void PageNode::accept(ASTVisitor& v)            { v.visit(*this); }
void FormNode::accept(ASTVisitor& v)            { v.visit(*this); }

} // namespace forml
