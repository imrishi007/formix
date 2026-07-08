#include "forml/semantic_analyzer.hpp"

namespace forml {

namespace {

bool isNumericField(FieldType type) {
    return type == FieldType::Integer || type == FieldType::Float;
}

bool isTextLikeField(FieldType type) {
    return type == FieldType::Text || type == FieldType::Email;
}

void collectFieldsFromNode(const ASTNode* node,
                           std::unordered_map<std::string, FieldType>& allFields) {
    if (!node) {
        return;
    }

    switch (node->kind()) {
        case NodeType::Form: {
            const auto& form = static_cast<const FormNode&>(*node);
            for (const auto& group : form.groupDefinitions) {
                collectFieldsFromNode(group.get(), allFields);
            }
            for (const auto& page : form.pages) {
                collectFieldsFromNode(page.get(), allFields);
            }
            for (const auto& stmt : form.statements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            break;
        }
        case NodeType::Page: {
            const auto& page = static_cast<const PageNode&>(*node);
            for (const auto& stmt : page.statements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            break;
        }
        case NodeType::GroupDefinition: {
            const auto& group = static_cast<const GroupDefinitionNode&>(*node);
            for (const auto& field : group.fields) {
                collectFieldsFromNode(field.get(), allFields);
            }
            break;
        }
        case NodeType::Section: {
            const auto& section = static_cast<const SectionNode&>(*node);
            for (const auto& stmt : section.statements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            break;
        }
        case NodeType::Layout: {
            const auto& layout = static_cast<const LayoutNode&>(*node);
            for (const auto& stmt : layout.statements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            break;
        }
        case NodeType::RepeatGroup: {
            const auto& repeat = static_cast<const RepeatGroupNode&>(*node);
            for (const auto& field : repeat.fields) {
                collectFieldsFromNode(field.get(), allFields);
            }
            break;
        }
        case NodeType::Conditional: {
            const auto& conditional = static_cast<const ConditionalNode&>(*node);
            for (const auto& stmt : conditional.thenStatements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            for (const auto& stmt : conditional.elseStatements) {
                collectFieldsFromNode(stmt.get(), allFields);
            }
            break;
        }
        case NodeType::Field: {
            const auto& field = static_cast<const FieldNode&>(*node);
            allFields.emplace(field.name, field.fieldType);
            break;
        }
        default:
            break;
    }
}

} // namespace

SemanticAnalyzer::SemanticAnalyzer(FormNode& form, DiagnosticEngine& diag)
    : form_(form)
    , diag_(diag) {}

void SemanticAnalyzer::analyze() {
    groupNames_.clear();
    varNames_.clear();
    pageNames_.clear();
    allFields_.clear();

    for (const auto& group : form_.groupDefinitions) {
        if (!groupNames_.insert(group->name).second) {
            error("Duplicate group definition name '" + group->name + "'", group->line, group->column);
        }
        collectFieldsFromNode(group.get(), allFields_);
    }

    for (const auto& var : form_.varDeclarations) {
        if (!varNames_.insert(var->name).second) {
            error("Duplicate var declaration name '" + var->name + "'", var->line, var->column);
        }
    }

    for (const auto& page : form_.pages) {
        if (!pageNames_.insert(page->name).second) {
            error("Duplicate page name '" + page->name + "'", page->line, page->column);
        }
        collectFieldsFromNode(page.get(), allFields_);
    }

    for (const auto& stmt : form_.statements) {
        collectFieldsFromNode(stmt.get(), allFields_);
    }

    visitForm(form_);
}

void SemanticAnalyzer::visitForm(FormNode& node) {
    for (const auto& group : node.groupDefinitions) {
        std::unordered_set<std::string> seenFields;
        visitGroupDefinition(*group, seenFields);
    }

    for (const auto& var : node.varDeclarations) {
        std::unordered_set<std::string> unused;
        visitVarDeclaration(*var, unused);
    }

    for (const auto& page : node.pages) {
        visitPage(*page);
    }

    std::unordered_set<std::string> topLevelFields;
    visitStatementList(node.statements, topLevelFields);
}

void SemanticAnalyzer::visitPage(PageNode& node) {
    std::unordered_set<std::string> seenFields;
    visitStatementList(node.statements, seenFields);
}

void SemanticAnalyzer::visitGroupDefinition(GroupDefinitionNode& node,
                                            std::unordered_set<std::string>& seenNames) {
    for (const auto& field : node.fields) {
        visitField(*field, seenNames);
    }
}

void SemanticAnalyzer::visitVarDeclaration(VarDeclarationNode& node,
                                           std::unordered_set<std::string>&) {
    checkVarLiteralOnly(node);
}

void SemanticAnalyzer::visitStatementList(NodeList& stmts,
                                          std::unordered_set<std::string>& seenFieldNames) {
    for (const auto& stmt : stmts) {
        if (stmt) {
            visitStatement(*stmt, seenFieldNames);
        }
    }
}

void SemanticAnalyzer::visitStatement(ASTNode& node,
                                      std::unordered_set<std::string>& seenFieldNames) {
    switch (node.kind()) {
        case NodeType::Field:
            visitField(static_cast<FieldNode&>(node), seenFieldNames);
            break;
        case NodeType::Section:
            visitSection(static_cast<SectionNode&>(node), seenFieldNames);
            break;
        case NodeType::Layout:
            visitLayout(static_cast<LayoutNode&>(node), seenFieldNames);
            break;
        case NodeType::RepeatGroup:
            visitRepeatGroup(static_cast<RepeatGroupNode&>(node), seenFieldNames);
            break;
        case NodeType::Conditional:
            visitConditional(static_cast<ConditionalNode&>(node), seenFieldNames);
            break;
        case NodeType::GroupUse:
            visitGroupUse(static_cast<GroupUseNode&>(node));
            break;
        default:
            break;
    }
}

void SemanticAnalyzer::visitField(FieldNode& node,
                                  std::unordered_set<std::string>& seenFieldNames) {
    if (!seenFieldNames.insert(node.name).second) {
        error("Duplicate field name '" + node.name + "' in this scope", node.line, node.column);
    }

    if (node.validationBlock) {
        checkValidationTypeCompat(node);
    }
    if (node.computeBlock && node.computeBlock->expr) {
        checkExprRefs(*node.computeBlock->expr);
    }
}

void SemanticAnalyzer::visitSection(SectionNode& node,
                                    std::unordered_set<std::string>&) {
    std::unordered_set<std::string> seenFields;
    visitStatementList(node.statements, seenFields);
}

void SemanticAnalyzer::visitLayout(LayoutNode& node,
                                   std::unordered_set<std::string>&) {
    std::unordered_set<std::string> seenFields;
    visitStatementList(node.statements, seenFields);
}

void SemanticAnalyzer::visitRepeatGroup(RepeatGroupNode& node,
                                        std::unordered_set<std::string>&) {
    checkRepeatCountRef(node);

    std::unordered_set<std::string> seenFields;
    for (const auto& field : node.fields) {
        if (field) {
            visitField(*field, seenFields);
        }
    }
}

void SemanticAnalyzer::visitConditional(ConditionalNode& node,
                                        std::unordered_set<std::string>&) {
    if (node.condition) {
        checkConditionRefs(*node.condition);
    }

    std::unordered_set<std::string> thenFields;
    visitStatementList(node.thenStatements, thenFields);

    std::unordered_set<std::string> elseFields;
    visitStatementList(node.elseStatements, elseFields);
}

void SemanticAnalyzer::visitGroupUse(GroupUseNode& node) {
    if (groupNames_.find(node.groupName) == groupNames_.end()) {
        error("Undefined group reference '" + node.groupName + "'", node.line, node.column);
    }
}

void SemanticAnalyzer::checkVarLiteralOnly(const VarDeclarationNode& node) {
    if (node.value && node.value->valueKind == ValueKind::Identifier) {
        error("Variable '" + node.name + "' must be assigned a literal value, not an identifier",
              node.line, node.column);
    }
}

void SemanticAnalyzer::checkValidationTypeCompat(const FieldNode& field) {
    if (!field.validationBlock) {
        return;
    }

    const auto& vb = *field.validationBlock;
    const bool textLike = isTextLikeField(field.fieldType);
    const bool numeric = isNumericField(field.fieldType);

    if (vb.min && !numeric) {
        error("Validation rule 'min' is only valid on integer/float fields", field.line, field.column);
    }
    if (vb.max && !numeric) {
        error("Validation rule 'max' is only valid on integer/float fields", field.line, field.column);
    }
    if (vb.minLength && !textLike) {
        error("Validation rule 'minLength' is only valid on text/email fields", field.line, field.column);
    }
    if (vb.maxLength && !textLike) {
        error("Validation rule 'maxLength' is only valid on text/email fields", field.line, field.column);
    }
    if (vb.pattern && !textLike) {
        error("Validation rule 'pattern' is only valid on text/email fields", field.line, field.column);
    }
}

void SemanticAnalyzer::checkIdentifierRef(const std::string& name, int line, int col,
                                          const std::string& context) {
    if (allFields_.find(name) != allFields_.end()) {
        return;
    }
    if (varNames_.find(name) != varNames_.end()) {
        return;
    }
    error("Undefined reference '" + name + "' in " + context, line, col);
}

void SemanticAnalyzer::checkRepeatCountRef(const RepeatGroupNode& node) {
    checkIdentifierRef(node.countRef, node.line, node.column, "repeat count");
}

void SemanticAnalyzer::checkConditionRefs(const CondExprNode& cond) {
    switch (cond.kind()) {
        case NodeType::BinaryCond: {
            const auto& binary = static_cast<const BinaryCondNode&>(cond);
            if (binary.left) {
                checkConditionRefs(*binary.left);
            }
            if (binary.right) {
                checkConditionRefs(*binary.right);
            }
            break;
        }
        case NodeType::SimpleCond: {
            const auto& simple = static_cast<const SimpleCondNode&>(cond);
            checkIdentifierRef(simple.fieldName, simple.line, simple.column, "simple condition");
            if (simple.value && simple.value->valueKind == ValueKind::Identifier) {
                checkIdentifierRef(simple.value->text, simple.value->line, simple.value->column,
                                   "simple condition");
            }
            break;
        }
        default:
            break;
    }
}

void SemanticAnalyzer::checkExprRefs(const ExprNode& expr) {
    switch (expr.kind()) {
        case NodeType::BinaryExpr: {
            const auto& binary = static_cast<const BinaryExprNode&>(expr);
            if (binary.left) {
                checkExprRefs(*binary.left);
            }
            if (binary.right) {
                checkExprRefs(*binary.right);
            }
            break;
        }
        case NodeType::IdentifierExpr: {
            const auto& ident = static_cast<const IdentifierExprNode&>(expr);
            checkIdentifierRef(ident.name, ident.line, ident.column, "math expression");
            break;
        }
        case NodeType::NumberLiteral:
            break;
        default:
            break;
    }
}

void SemanticAnalyzer::error(const std::string& msg, int line, int col) {
    diag_.error(msg, line, col);
}

} // namespace forml
