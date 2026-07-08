// src/json_serializer.cpp - JSON serialization visitor implementation.

#include "forml/json_serializer.hpp"

#include <utility>

namespace forml {

namespace {

std::string valueKindToString(ValueKind kind) {
    switch (kind) {
        case ValueKind::StringLit:  return "string";
        case ValueKind::NumberLit:  return "number";
        case ValueKind::BoolTrue:   return "boolean";
        case ValueKind::BoolFalse:  return "boolean";
        case ValueKind::Identifier: return "identifier";
    }
    return "unknown";
}

std::string sourceKindToString(SourceKind kind) {
    return kind == SourceKind::Url ? "url" : "var";
}

std::string actionKindToString(ActionKind kind) {
    switch (kind) {
        case ActionKind::Hide:     return "hide";
        case ActionKind::Show:     return "show";
        case ActionKind::Clear:    return "clear";
        case ActionKind::Set:      return "set";
        case ActionKind::Navigate: return "navigate";
        case ActionKind::Submit:   return "submit";
    }
    return "unknown";
}

std::string eventTypeToString(EventType type) {
    switch (type) {
        case EventType::Load:   return "load";
        case EventType::Change: return "change";
        case EventType::Blur:   return "blur";
        case EventType::Submit: return "submit";
    }
    return "unknown";
}

std::string httpMethodToString(HttpMethod method) {
    switch (method) {
        case HttpMethod::Post:  return "POST";
        case HttpMethod::Put:   return "PUT";
        case HttpMethod::Patch: return "PATCH";
    }
    return "UNKNOWN";
}

std::string layoutKindToString(LayoutKind kind) {
    return kind == LayoutKind::Row ? "row" : "column";
}

nlohmann::json location(int line, int column) {
    return nlohmann::json{{"line", line}, {"column", column}};
}

} // namespace

nlohmann::json JsonSerializer::serialize(FormNode& form) {
    return serializeNode(form);
}

nlohmann::json JsonSerializer::serializeNode(ASTNode& node) {
    node.accept(*this);
    return std::move(current_);
}

nlohmann::json JsonSerializer::serializeValue(ValueNode* node) {
    if (!node) {
        return nullptr;
    }
    return serializeNode(*node);
}

nlohmann::json JsonSerializer::serializeExpr(ExprNode* node) {
    if (!node) {
        return nullptr;
    }
    return serializeNode(*node);
}

nlohmann::json JsonSerializer::serializeCond(CondExprNode* node) {
    if (!node) {
        return nullptr;
    }
    return serializeNode(*node);
}

nlohmann::json JsonSerializer::serializeStatementList(NodeList& statements) {
    nlohmann::json result = nlohmann::json::array();
    for (auto& statement : statements) {
        if (statement) {
            result.push_back(serializeNode(*statement));
        }
    }
    return result;
}

nlohmann::json JsonSerializer::serializeFields(std::vector<std::unique_ptr<FieldNode>>& fields) {
    nlohmann::json result = nlohmann::json::array();
    for (auto& field : fields) {
        if (field) {
            result.push_back(serializeNode(*field));
        }
    }
    return result;
}

nlohmann::json JsonSerializer::serializeUIBlock(const UIBlockNode& block) {
    nlohmann::json json{{"type", "UIBlock"}};
    if (block.label) {
        json["label"] = *block.label;
    }
    if (block.placeholder) {
        json["placeholder"] = *block.placeholder;
    }
    if (block.helpText) {
        json["helpText"] = *block.helpText;
    }
    if (block.defaultValue && block.defaultValue->get()) {
        json["default"] = serializeValue(block.defaultValue->get());
    }
    if (block.bind) {
        json["bind"] = *block.bind;
    }
    return json;
}

nlohmann::json JsonSerializer::serializeValidationBlock(const ValidationBlockNode& block) {
    nlohmann::json json{{"type", "ValidationBlock"}};
    if (block.required) {
        json["required"] = true;
    }
    if (block.min) {
        json["min"] = *block.min;
    }
    if (block.max) {
        json["max"] = *block.max;
    }
    if (block.minLength) {
        json["minLength"] = *block.minLength;
    }
    if (block.maxLength) {
        json["maxLength"] = *block.maxLength;
    }
    if (block.pattern) {
        json["pattern"] = *block.pattern;
    }
    return json;
}

void JsonSerializer::visit(ValueNode& node) {
    current_ = {
        {"type", "Value"},
        {"valueKind", valueKindToString(node.valueKind)},
        {"text", node.text},
        {"location", location(node.line, node.column)}
    };
    if (node.valueKind == ValueKind::NumberLit) {
        current_["numberValue"] = node.dval;
    } else if (node.valueKind == ValueKind::BoolTrue) {
        current_["booleanValue"] = true;
    } else if (node.valueKind == ValueKind::BoolFalse) {
        current_["booleanValue"] = false;
    }
}

void JsonSerializer::visit(BinaryExprNode& node) {
    nlohmann::json json = {
        {"type", "BinaryExpr"},
        {"operator", node.op},
        {"left", serializeExpr(node.left.get())},
        {"right", serializeExpr(node.right.get())},
        {"location", location(node.line, node.column)}
    };
    current_ = std::move(json);
}

void JsonSerializer::visit(IdentifierExprNode& node) {
    current_ = {
        {"type", "IdentifierExpr"},
        {"name", node.name},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(NumberLiteralNode& node) {
    current_ = {
        {"type", "NumberLiteral"},
        {"value", node.value},
        {"raw", node.raw},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(BinaryCondNode& node) {
    nlohmann::json json = {
        {"type", "BinaryCond"},
        {"operator", node.op},
        {"left", serializeCond(node.left.get())},
        {"right", serializeCond(node.right.get())},
        {"location", location(node.line, node.column)}
    };
    current_ = std::move(json);
}

void JsonSerializer::visit(SimpleCondNode& node) {
    nlohmann::json json = {
        {"type", "SimpleCond"},
        {"field", node.fieldName},
        {"comparator", node.comparator},
        {"value", serializeValue(node.value.get())},
        {"location", location(node.line, node.column)}
    };
    current_ = std::move(json);
}

void JsonSerializer::visit(SourceBlockNode& node) {
    current_ = {
        {"type", "SourceBlock"},
        {"sourceKind", sourceKindToString(node.sourceKind)},
        {"source", node.source},
        {"location", location(node.line, node.column)}
    };
    if (node.mapLabel || node.mapValue) {
        current_["map"] = {
            {"label", node.mapLabel.value_or("")},
            {"value", node.mapValue.value_or("")}
        };
    }
}

void JsonSerializer::visit(ComputeBlockNode& node) {
    nlohmann::json json = {
        {"type", "ComputeBlock"},
        {"expression", serializeExpr(node.expr.get())},
        {"location", location(node.line, node.column)}
    };
    current_ = std::move(json);
}

void JsonSerializer::visit(ActionStatementNode& node) {
    nlohmann::json json = {
        {"type", "ActionStatement"},
        {"action", actionKindToString(node.actionKind)},
        {"location", location(node.line, node.column)}
    };
    if (!node.target.empty()) {
        json["target"] = node.target;
    }
    if (node.setValue) {
        json["value"] = serializeValue(node.setValue.get());
    }
    current_ = std::move(json);
}

void JsonSerializer::visit(TriggerBlockNode& node) {
    nlohmann::json actions = nlohmann::json::array();
    for (auto& action : node.actions) {
        if (action) {
            actions.push_back(serializeNode(*action));
        }
    }

    current_ = {
        {"type", "TriggerBlock"},
        {"event", eventTypeToString(node.eventType)},
        {"actions", actions},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(ActionBlockNode& node) {
    current_ = {
        {"type", "ActionBlock"},
        {"endpoint", node.endpoint},
        {"method", httpMethodToString(node.method)},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(FieldNode& node) {
    nlohmann::json json = {
        {"type", "Field"},
        {"name", node.name},
        {"fieldType", fieldTypeToString(node.fieldType)},
        {"options", node.options},
        {"location", location(node.line, node.column)}
    };
    if (node.source) {
        json["source"] = serializeNode(*node.source);
    }
    if (node.uiBlock) {
        json["ui"] = serializeUIBlock(*node.uiBlock);
    }
    if (node.validationBlock) {
        json["validation"] = serializeValidationBlock(*node.validationBlock);
    }
    if (node.computeBlock) {
        json["compute"] = serializeNode(*node.computeBlock);
    }
    if (node.triggerBlock) {
        json["trigger"] = serializeNode(*node.triggerBlock);
    }
    current_ = std::move(json);
}

void JsonSerializer::visit(GroupDefinitionNode& node) {
    current_ = {
        {"type", "GroupDefinition"},
        {"name", node.name},
        {"fields", serializeFields(node.fields)},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(GroupUseNode& node) {
    current_ = {
        {"type", "GroupUse"},
        {"groupName", node.groupName},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(VarDeclarationNode& node) {
    current_ = {
        {"type", "VarDeclaration"},
        {"name", node.name},
        {"value", serializeValue(node.value.get())},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(SectionNode& node) {
    current_ = {
        {"type", "Section"},
        {"name", node.name},
        {"statements", serializeStatementList(node.statements)},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(LayoutNode& node) {
    current_ = {
        {"type", "Layout"},
        {"layoutKind", layoutKindToString(node.layoutKind)},
        {"statements", serializeStatementList(node.statements)},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(RepeatGroupNode& node) {
    current_ = {
        {"type", "RepeatGroup"},
        {"countRef", node.countRef},
        {"fields", serializeFields(node.fields)},
        {"location", location(node.line, node.column)}
    };
}

void JsonSerializer::visit(ConditionalNode& node) {
    nlohmann::json json = {
        {"type", "Conditional"},
        {"condition", serializeCond(node.condition.get())},
        {"then", serializeStatementList(node.thenStatements)},
        {"else", serializeStatementList(node.elseStatements)},
        {"location", location(node.line, node.column)}
    };
    current_ = std::move(json);
}

void JsonSerializer::visit(PageNode& node) {
    nlohmann::json json = {
        {"type", "Page"},
        {"name", node.name},
        {"statements", serializeStatementList(node.statements)},
        {"location", location(node.line, node.column)}
    };
    if (node.triggerBlock) {
        json["trigger"] = serializeNode(*node.triggerBlock);
    }
    current_ = std::move(json);
}

void JsonSerializer::visit(FormNode& node) {
    nlohmann::json groups = nlohmann::json::array();
    for (auto& group : node.groupDefinitions) {
        if (group) {
            groups.push_back(serializeNode(*group));
        }
    }

    nlohmann::json vars = nlohmann::json::array();
    for (auto& var : node.varDeclarations) {
        if (var) {
            vars.push_back(serializeNode(*var));
        }
    }

    nlohmann::json pages = nlohmann::json::array();
    for (auto& page : node.pages) {
        if (page) {
            pages.push_back(serializeNode(*page));
        }
    }

    nlohmann::json json = {
        {"type", "Form"},
        {"name", node.name},
        {"groupDefinitions", groups},
        {"varDeclarations", vars},
        {"pages", pages},
        {"statements", serializeStatementList(node.statements)},
        {"location", location(node.line, node.column)}
    };
    if (node.actionBlock) {
        json["action"] = serializeNode(*node.actionBlock);
    }
    current_ = std::move(json);
}

} // namespace forml
