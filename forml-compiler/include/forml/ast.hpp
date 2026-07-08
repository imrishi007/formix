// include/forml/ast.hpp - AST node definitions for Forml.

#pragma once

#include <string>
#include <vector>
#include <memory>    // std::unique_ptr
#include <optional>  // std::optional — for nullable child nodes

namespace forml {

// Forward declaration for the Stage 5 visitor.
class ASTVisitor;

// NodeType identifies each concrete AST node.

enum class NodeType {
    Form,
    Page,
    GroupDefinition,
    GroupUse,
    VarDeclaration,
    Field,
    Section,
    Layout,
    RepeatGroup,
    Conditional,
    UIBlock,
    ValidationBlock,
    ComputeBlock,
    TriggerBlock,
    ActionStatement,
    ActionBlock,
    SourceBlock,
    // Expression nodes (math hierarchy)
    BinaryExpr,
    IdentifierExpr,
    NumberLiteral,
    // Condition nodes (boolean logic hierarchy — SEPARATE from expressions)
    BinaryCond,       // || or &&
    SimpleCond,       // IDENTIFIER comparator value
    Value,            // STRING | NUMBER | true | false | IDENTIFIER
};

// nodeTypeToString returns a printable node name.
std::string nodeTypeToString(NodeType kind);


// ASTNode is the abstract base for all AST nodes.

class ASTNode {
public:
    // Stores the node kind for lightweight dispatch.
    explicit ASTNode(NodeType kind) : kind_(kind) {}

    virtual ~ASTNode() = default;

    // Accepts a visitor.
    virtual void accept(ASTVisitor& visitor) = 0;

    NodeType kind() const { return kind_; }

protected:
    NodeType kind_;
};

// Common node container aliases.
using NodePtr  = std::unique_ptr<ASTNode>;
using NodeList = std::vector<NodePtr>;


// =============================================================================
//  ValueNode  —  grammar rule: value = STRING | NUMBER | "true" | "false" | IDENTIFIER
// =============================================================================
//  `value` appears in: var_declaration, default ui_rule, condition rhs,
//  set() action statement, and action_statement arguments.
//
//  Rather than a separate node hierarchy for such a tiny construct, we use a
//  tagged struct with an enum discriminant.  This keeps the AST shallow.
//
//  ValueNode IS a proper AST node (inherits ASTNode) so the visitor can reach it
//  if needed, but in practice parent nodes often pattern-match on its `kind` field
//  directly rather than visiting it separately.
// =============================================================================

enum class ValueKind {
    StringLit,      // "..." quoted string — text stores the stripped content
    NumberLit,      // integer or float — text stores raw lexeme, numeric in dval
    BoolTrue,       // the literal `true`
    BoolFalse,      // the literal `false`
    Identifier,     // a field/var reference — text stores the name
};

class ValueNode : public ASTNode {
public:
    ValueKind   valueKind;
    std::string text;   // raw lexeme or stripped string content
    double      dval;   // numeric value (valid only for NumberLit)
    int         line;
    int         column;

    ValueNode(ValueKind vk, std::string t, double d, int ln, int col)
        : ASTNode(NodeType::Value)
        , valueKind(vk), text(std::move(t)), dval(d), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// =============================================================================
//  Expression node hierarchy  —  grammar §6: expression / math_term / math_factor
// =============================================================================
//  These represent arithmetic compute expressions.
//
//  Grammar (precedence low → high):
//    expression  = math_term  { ("+" | "-") math_term }
//    math_term   = math_factor { ("*" | "/") math_factor }
//    math_factor = IDENTIFIER | NUMBER | "(" expression ")"
//
//  We represent binary operations with BinaryExprNode, and the two leaf types
// Expression nodes model arithmetic compute expressions.

// Forward declarations so BinaryExprNode can hold unique_ptrs to ExprNode.
class ExprNode;
using ExprPtr = std::unique_ptr<ExprNode>;

class ExprNode : public ASTNode {
public:
    explicit ExprNode(NodeType k) : ASTNode(k) {}
};

// BinaryExprNode stores a binary arithmetic operator.
class BinaryExprNode : public ExprNode {
public:
    std::string op;   // "+", "-", "*", "/"
    ExprPtr     left;
    ExprPtr     right;
    int         line;
    int         column;

    BinaryExprNode(std::string o, ExprPtr l, ExprPtr r, int ln, int col)
        : ExprNode(NodeType::BinaryExpr)
        , op(std::move(o)), left(std::move(l)), right(std::move(r))
        , line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};

// IdentifierExprNode stores a named reference in an expression.
class IdentifierExprNode : public ExprNode {
public:
    std::string name;
    int         line;
    int         column;

    IdentifierExprNode(std::string n, int ln, int col)
        : ExprNode(NodeType::IdentifierExpr)
        , name(std::move(n)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};

// NumberLiteralNode stores a numeric literal.
class NumberLiteralNode : public ExprNode {
public:
    double      value;
    std::string raw;    // original lexeme text (for faithful reproduction)
    int         line;
    int         column;

    NumberLiteralNode(double v, std::string r, int ln, int col)
        : ExprNode(NodeType::NumberLiteral)
        , value(v), raw(std::move(r)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// Condition nodes model boolean logic in if statements.

class CondExprNode;
using CondPtr = std::unique_ptr<CondExprNode>;

class CondExprNode : public ASTNode {
public:
    explicit CondExprNode(NodeType k) : ASTNode(k) {}
};

// BinaryCondNode stores && or ||.
class BinaryCondNode : public CondExprNode {
public:
    std::string op;    // "||" or "&&"
    CondPtr     left;
    CondPtr     right;
    int         line;
    int         column;

    BinaryCondNode(std::string o, CondPtr l, CondPtr r, int ln, int col)
        : CondExprNode(NodeType::BinaryCond)
        , op(std::move(o)), left(std::move(l)), right(std::move(r))
        , line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};

// SimpleCondNode stores one comparison predicate.
class SimpleCondNode : public CondExprNode {
public:
    std::string fieldName;   // the IDENTIFIER on the left
    std::string comparator;  // "==", "!=", "<", ">", "<=", ">="
    std::unique_ptr<ValueNode> value;  // the value on the right
    int         line;
    int         column;

    SimpleCondNode(std::string fn, std::string cmp,
                   std::unique_ptr<ValueNode> v, int ln, int col)
        : CondExprNode(NodeType::SimpleCond)
        , fieldName(std::move(fn)), comparator(std::move(cmp))
        , value(std::move(v)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// UIBlockNode stores field presentation metadata.

struct UIBlockNode {
    std::optional<std::string>               label;
    std::optional<std::string>               placeholder;
    std::optional<std::string>               helpText;
    std::optional<std::unique_ptr<ValueNode>> defaultValue;
    std::optional<std::string>               bind;
};


// ValidationBlockNode stores validation rules for a field.

struct ValidationBlockNode {
    bool                    required  = false;
    std::optional<double>   min;
    std::optional<double>   max;
    std::optional<double>   minLength;
    std::optional<double>   maxLength;
    std::optional<std::string> pattern;
};


// SourceBlockNode stores a dynamic option source.

enum class SourceKind { Url, Var };

class SourceBlockNode : public ASTNode {
public:
    SourceKind  sourceKind;
    std::string source;         // the URL string (stripped) or var name
    std::optional<std::string> mapLabel;
    std::optional<std::string> mapValue;
    int line;
    int column;

    SourceBlockNode(SourceKind sk, std::string src, int ln, int col)
        : ASTNode(NodeType::SourceBlock)
        , sourceKind(sk), source(std::move(src)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// ComputeBlockNode stores a compute expression.

class ComputeBlockNode : public ASTNode {
public:
    ExprPtr expr;   // the arithmetic expression
    int     line;
    int     column;

    ComputeBlockNode(ExprPtr e, int ln, int col)
        : ASTNode(NodeType::ComputeBlock)
        , expr(std::move(e)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// ActionStatementNode stores one trigger action.

enum class ActionKind {
    Hide,
    Show,
    Clear,
    Set,
    Navigate,
    Submit,
};

class ActionStatementNode : public ASTNode {
public:
    ActionKind  actionKind;
    std::string target;
    std::unique_ptr<ValueNode> setValue;
    int line;
    int column;

    ActionStatementNode(ActionKind ak, std::string tgt,
                        std::unique_ptr<ValueNode> sv, int ln, int col)
        : ASTNode(NodeType::ActionStatement)
        , actionKind(ak), target(std::move(tgt))
        , setValue(std::move(sv)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// TriggerBlockNode stores lifecycle-triggered actions.

enum class EventType { Load, Change, Blur, Submit };

class TriggerBlockNode : public ASTNode {
public:
    EventType eventType;
    std::vector<std::unique_ptr<ActionStatementNode>> actions;
    int line;
    int column;

    TriggerBlockNode(EventType et, int ln, int col)
        : ASTNode(NodeType::TriggerBlock)
        , eventType(et), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// ActionBlockNode stores the form submission target.

enum class HttpMethod { Post, Put, Patch };

class ActionBlockNode : public ASTNode {
public:
    std::string endpoint;
    HttpMethod  method;
    int         line;
    int         column;

    ActionBlockNode(std::string ep, HttpMethod m, int ln, int col)
        : ASTNode(NodeType::ActionBlock)
        , endpoint(std::move(ep)), method(m), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// FieldNode stores one declared field.

enum class FieldType {
    Text,
    Integer,
    Float,
    Email,
    Date,
    Boolean,
    Url,
    Select,
    Radio,
    Checkbox,
};

std::string fieldTypeToString(FieldType t);

class FieldNode : public ASTNode {
public:
    std::string name;
    FieldType   fieldType;

    std::vector<std::string>              options;
    std::unique_ptr<SourceBlockNode>      source;

    std::optional<UIBlockNode>            uiBlock;
    std::optional<ValidationBlockNode>    validationBlock;
    std::unique_ptr<ComputeBlockNode>     computeBlock;
    std::unique_ptr<TriggerBlockNode>     triggerBlock;

    int line;
    int column;

    FieldNode(std::string n, FieldType ft, int ln, int col)
        : ASTNode(NodeType::Field)
        , name(std::move(n)), fieldType(ft), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// GroupDefinitionNode stores a reusable group of fields.

class GroupDefinitionNode : public ASTNode {
public:
    std::string name;
    std::vector<std::unique_ptr<FieldNode>> fields;
    int line;
    int column;

    GroupDefinitionNode(std::string n, int ln, int col)
        : ASTNode(NodeType::GroupDefinition)
        , name(std::move(n)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// GroupUseNode references a named group.

class GroupUseNode : public ASTNode {
public:
    std::string groupName;
    int         line;
    int         column;

    GroupUseNode(std::string gn, int ln, int col)
        : ASTNode(NodeType::GroupUse)
        , groupName(std::move(gn)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// VarDeclarationNode stores a form-level variable.

class VarDeclarationNode : public ASTNode {
public:
    std::string                name;
    std::unique_ptr<ValueNode> value;
    int                        line;
    int                        column;

    VarDeclarationNode(std::string n, std::unique_ptr<ValueNode> v, int ln, int col)
        : ASTNode(NodeType::VarDeclaration)
        , name(std::move(n)), value(std::move(v)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// SectionNode stores a named statement block.

class SectionNode : public ASTNode {
public:
    std::string name;
    NodeList    statements;
    int         line;
    int         column;

    SectionNode(std::string n, int ln, int col)
        : ASTNode(NodeType::Section)
        , name(std::move(n)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// LayoutNode stores a row or column block.

enum class LayoutKind { Row, Column };

class LayoutNode : public ASTNode {
public:
    LayoutKind layoutKind;
    NodeList   statements;
    int        line;
    int        column;

    LayoutNode(LayoutKind lk, int ln, int col)
        : ASTNode(NodeType::Layout)
        , layoutKind(lk), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// RepeatGroupNode stores a repeated field block.

class RepeatGroupNode : public ASTNode {
public:
    std::string                             countRef;  // IDENTIFIER name
    std::vector<std::unique_ptr<FieldNode>> fields;
    int                                     line;
    int                                     column;

    RepeatGroupNode(std::string cr, int ln, int col)
        : ASTNode(NodeType::RepeatGroup)
        , countRef(std::move(cr)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// ConditionalNode stores an if/else branch.

class ConditionalNode : public ASTNode {
public:
    CondPtr  condition;
    NodeList thenStatements;
    NodeList elseStatements;  // empty if no else branch
    int      line;
    int      column;

    ConditionalNode(CondPtr cond, int ln, int col)
        : ASTNode(NodeType::Conditional)
        , condition(std::move(cond)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// PageNode stores a named page.

class PageNode : public ASTNode {
public:
    std::string                    name;
    NodeList                       statements;
    std::unique_ptr<TriggerBlockNode> triggerBlock;  // null if absent
    int                            line;
    int                            column;

    PageNode(std::string n, int ln, int col)
        : ASTNode(NodeType::Page)
        , name(std::move(n)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// FormNode stores the root form.

class FormNode : public ASTNode {
public:
    std::string name;  // stripped string, e.g. "Fleet Registration"

    // Separated for semantic-analyzer convenience:
    std::vector<std::unique_ptr<GroupDefinitionNode>> groupDefinitions;
    std::vector<std::unique_ptr<VarDeclarationNode>>  varDeclarations;
    std::vector<std::unique_ptr<PageNode>>            pages;
    NodeList                                           statements;  // non-page top-level statements

    std::unique_ptr<ActionBlockNode> actionBlock;  // null if absent
    int line;
    int column;

    FormNode(std::string n, int ln, int col)
        : ASTNode(NodeType::Form)
        , name(std::move(n)), line(ln), column(col) {}

    void accept(ASTVisitor& v) override;
};


// stripQuotes removes surrounding double quotes from a string lexeme.

inline std::string stripQuotes(const std::string& s) {
    if (s.size() >= 2 && s.front() == '"' && s.back() == '"') {
        return s.substr(1, s.size() - 2);
    }
    return s;
}

} // namespace forml
