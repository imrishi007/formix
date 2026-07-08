// src/parser.cpp — Forml recursive descent parser.
// One function per EBNF rule. Read alongside EBNF_grammar.md.

#include "forml/parser.hpp"
#include <sstream>
#include <stdexcept>
#include <cassert>

namespace forml {

// ── static sentinel ──────────────────────────────────────────────────────────
// Returned by reference from expect() on mismatch so callers always get a
// valid Token& without crashing on a null dereference.
const Token Parser::dummyToken_ = Token{ TokenType::ERROR, "", 0, 0 };

// ── constructor ──────────────────────────────────────────────────────────────
Parser::Parser(const std::vector<Token>& tokens, DiagnosticEngine& diag)
    : tokens_(tokens), diag_(diag), current_(0) {}

// ── token stream navigation ───────────────────────────────────────────────────
const Token& Parser::peek() const    { return tokens_[current_]; }
const Token& Parser::previous() const {
    return current_ > 0 ? tokens_[current_ - 1] : tokens_[0];
}
const Token& Parser::peekAt(std::size_t offset) const {
    std::size_t idx = current_ + offset;
    return idx < tokens_.size() ? tokens_[idx] : tokens_.back();
}
bool Parser::isAtEnd() const  { return peek().type == TokenType::END_OF_FILE; }
const Token& Parser::advance() {
    if (!isAtEnd()) current_++;
    return previous();
}
bool Parser::check(TokenType t) const  { return peek().type == t; }
bool Parser::match(TokenType t)        { if (check(t)) { advance(); return true; } return false; }
const Token& Parser::expect(TokenType type, const std::string& msg) {
    if (check(type)) return advance();
    error(peek(), msg);
    return dummyToken_;
}

// ── hard / soft keyword tables ────────────────────────────────────────────────
// Hard: never valid as a user-defined name anywhere.
// Soft: reserved only in their specific grammar position; usable as IDENTIFIER
//       everywhere else (field names, var names, group names, references).
bool Parser::isHardKeyword(TokenType t) {
    switch (t) {
        case TokenType::KW_FORM:   case TokenType::KW_PAGE:
        case TokenType::KW_FIELD:  case TokenType::KW_GROUP:
        case TokenType::KW_USE:    case TokenType::KW_VAR:
        case TokenType::KW_IF:     case TokenType::KW_ELSE:
        case TokenType::KW_ON:     case TokenType::KW_ACTION:
        case TokenType::KW_COMPUTE:case TokenType::KW_REPEAT:
        case TokenType::KW_COUNT:
            return true;
        default: return false;
    }
}

bool Parser::isSoftKeyword(TokenType t) {
    switch (t) {
        // types
        case TokenType::KW_TEXT:     case TokenType::KW_INTEGER:
        case TokenType::KW_FLOAT:    case TokenType::KW_EMAIL:
        case TokenType::KW_DATE:     case TokenType::KW_BOOLEAN:
        case TokenType::KW_URL:      case TokenType::KW_SELECT:
        case TokenType::KW_RADIO:    case TokenType::KW_CHECKBOX:
        case TokenType::KW_OPTION:
        // data sourcing
        case TokenType::KW_FROM:     case TokenType::KW_MAP:
        case TokenType::KW_LABEL:    case TokenType::KW_VALUE:
        // ui / validation
        case TokenType::KW_UI:       case TokenType::KW_VALIDATE:
        case TokenType::KW_PLACEHOLDER: case TokenType::KW_HELP_TEXT:
        case TokenType::KW_DEFAULT:  case TokenType::KW_BIND:
        case TokenType::KW_REQUIRED: case TokenType::KW_MIN:
        case TokenType::KW_MAX:      case TokenType::KW_MIN_LENGTH:
        case TokenType::KW_MAX_LENGTH: case TokenType::KW_PATTERN:
        // layout
        case TokenType::KW_ROW:      case TokenType::KW_COLUMN:
        // actions / events
        case TokenType::KW_SUBMIT:   case TokenType::KW_LOAD:
        case TokenType::KW_CHANGE:   case TokenType::KW_BLUR:
        case TokenType::KW_HIDE:     case TokenType::KW_SHOW:
        case TokenType::KW_CLEAR:    case TokenType::KW_SET:
        case TokenType::KW_NAVIGATE: case TokenType::KW_ENDPOINT:
        case TokenType::KW_METHOD:
        // HTTP methods
        case TokenType::KW_POST:     case TokenType::KW_PUT:
        case TokenType::KW_PATCH:
        // booleans / section
        case TokenType::KW_TRUE:     case TokenType::KW_FALSE:
        case TokenType::KW_SECTION:
            return true;
        default: return false;
    }
}

// Accepts IDENTIFIER or any soft keyword as a name; rejects hard keywords.
const Token& Parser::expectIdentifierLike() {
    if (check(TokenType::IDENTIFIER) || isSoftKeyword(peek().type))
        return advance();
    if (isHardKeyword(peek().type))
        error(peek(), "'" + peek().lexeme + "' is a reserved keyword and cannot be used as a name here");
    else
        error(peek(), "Expected identifier, got '" + peek().lexeme + "'");
    return dummyToken_;
}

// ── error recovery ────────────────────────────────────────────────────────────
void Parser::error(const Token& tok, const std::string& message) {
    diag_.error(message, tok.line, tok.column);
}

// Panic-mode: skip tokens until we reach a clean resync point.
// Stops AT statement-starting keywords (doesn't consume them) or AFTER
// consuming a RIGHT_BRACE that closes the broken block.
void Parser::synchronize() {
    while (!isAtEnd()) {
        // Just consumed a '}': we're past the broken block.
        if (previous().type == TokenType::RIGHT_BRACE) return;

        switch (peek().type) {
            // Statement starters: stop before consuming so the outer loop
            // can pick them up cleanly.
            case TokenType::KW_FORM:    case TokenType::KW_PAGE:
            case TokenType::KW_FIELD:   case TokenType::KW_GROUP:
            case TokenType::KW_USE:     case TokenType::KW_VAR:
            case TokenType::KW_IF:      case TokenType::KW_ON:
            case TokenType::KW_ACTION:  case TokenType::KW_REPEAT:
            case TokenType::KW_SECTION: case TokenType::KW_ROW:
            case TokenType::KW_COLUMN:
                return;
            case TokenType::RIGHT_BRACE:
                advance();  // consume the brace and stop
                return;
            default:
                advance();
                break;
        }
    }
}

// ── public entry ──────────────────────────────────────────────────────────────
std::unique_ptr<FormNode> Parser::parse() {
    if (!check(TokenType::KW_FORM)) {
        error(peek(), "Expected 'form' at the start of a .forml file");
        return nullptr;
    }
    return parseForm();
}

// ── §2: form ──────────────────────────────────────────────────────────────────
// EBNF: form = "form" STRING "{" { group_definition | var_declaration | page | statement }
//              [ action_block ] "}" ;
std::unique_ptr<FormNode> Parser::parseForm() {
    const Token& formTok = expect(TokenType::KW_FORM,   "Expected 'form'");
    const Token& nameTok = expect(TokenType::STRING,    "Expected form name string");
    expect(TokenType::LEFT_BRACE, "Expected '{' after form name");

    auto node = std::make_unique<FormNode>(stripQuotes(nameTok.lexeme),
                                           formTok.line, formTok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if      (check(TokenType::KW_GROUP))  node->groupDefinitions.push_back(parseGroupDefinition());
        else if (check(TokenType::KW_VAR))    node->varDeclarations.push_back(parseVarDeclaration());
        else if (check(TokenType::KW_PAGE))   node->pages.push_back(parsePage());
        else if (check(TokenType::KW_ACTION)) node->actionBlock = parseActionBlock();
        else {
            auto stmt = parseStatement();
            if (stmt) node->statements.push_back(std::move(stmt));
        }
        // If nothing advanced, force-skip to avoid infinite loop.
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }

    expect(TokenType::RIGHT_BRACE, "Expected '}' to close form body");
    return node;
}

// ── §2: page ──────────────────────────────────────────────────────────────────
// EBNF: page = "page" STRING "{" { statement } [ trigger_block ] "}" ;
std::unique_ptr<PageNode> Parser::parsePage() {
    const Token& pageTok = expect(TokenType::KW_PAGE, "Expected 'page'");
    const Token& nameTok = expect(TokenType::STRING,  "Expected page name string");
    expect(TokenType::LEFT_BRACE, "Expected '{' after page name");

    auto node = std::make_unique<PageNode>(stripQuotes(nameTok.lexeme),
                                           pageTok.line, pageTok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if (check(TokenType::KW_ON)) {
            node->triggerBlock = parseTriggerBlock();
        } else {
            auto stmt = parseStatement();
            if (stmt) node->statements.push_back(std::move(stmt));
        }
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }

    expect(TokenType::RIGHT_BRACE, "Expected '}' to close page body");
    return node;
}

// ── §2: statement ─────────────────────────────────────────────────────────────
// EBNF: statement = field | section | repeat_group | conditional | group_use | layout_block ;
NodePtr Parser::parseStatement() {
    if (check(TokenType::KW_FIELD))   return parseField();
    if (check(TokenType::KW_SECTION)) return parseSection();
    if (check(TokenType::KW_REPEAT))  return parseRepeatGroup();
    if (check(TokenType::KW_IF))      return parseConditional();
    if (check(TokenType::KW_USE))     return parseGroupUse();
    if (check(TokenType::KW_ROW) || check(TokenType::KW_COLUMN))
                                      return parseLayoutBlock();

    error(peek(), "Unexpected token '" + peek().lexeme + "' in statement position");
    synchronize();
    return nullptr;
}

// ── §3: group_definition ─────────────────────────────────────────────────────
// EBNF: group_definition = "group" IDENTIFIER "{" { field } "}" ;
std::unique_ptr<GroupDefinitionNode> Parser::parseGroupDefinition() {
    const Token& tok  = expect(TokenType::KW_GROUP, "Expected 'group'");
    const Token& name = expectIdentifierLike();
    expect(TokenType::LEFT_BRACE, "Expected '{' after group name");

    auto node = std::make_unique<GroupDefinitionNode>(name.lexeme, tok.line, tok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if (check(TokenType::KW_FIELD)) {
            node->fields.push_back(parseField());
        } else {
            error(peek(), "Only 'field' declarations are allowed inside a group body");
            synchronize();
        }
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }

    expect(TokenType::RIGHT_BRACE, "Expected '}' to close group body");
    return node;
}

// ── §3: group_use ─────────────────────────────────────────────────────────────
// EBNF: group_use = "use" IDENTIFIER ;
std::unique_ptr<GroupUseNode> Parser::parseGroupUse() {
    const Token& tok  = expect(TokenType::KW_USE, "Expected 'use'");
    const Token& name = expectIdentifierLike();
    return std::make_unique<GroupUseNode>(name.lexeme, tok.line, tok.column);
}

// ── §3: var_declaration ───────────────────────────────────────────────────────
// EBNF: var_declaration = "var" IDENTIFIER "=" value ";" ;
// Note: grammar allows IDENTIFIER on RHS; semantic pass enforces literal-only.
std::unique_ptr<VarDeclarationNode> Parser::parseVarDeclaration() {
    const Token& tok  = expect(TokenType::KW_VAR, "Expected 'var'");
    const Token& name = expectIdentifierLike();
    expect(TokenType::EQUALS,     "Expected '=' after variable name");
    auto val = parseValue();
    expect(TokenType::SEMICOLON,  "Expected ';' at end of var declaration");
    return std::make_unique<VarDeclarationNode>(name.lexeme, std::move(val),
                                                tok.line, tok.column);
}

// ── §4: field ─────────────────────────────────────────────────────────────────
// EBNF: field = "field" IDENTIFIER ":" type [ui] [validate] [compute] [trigger] ;
std::unique_ptr<FieldNode> Parser::parseField() {
    const Token& tok  = expect(TokenType::KW_FIELD, "Expected 'field'");
    const Token& name = expectIdentifierLike();
    expect(TokenType::COLON, "Expected ':' after field name");

    FieldType ft = parseType();
    auto node = std::make_unique<FieldNode>(name.lexeme, ft, tok.line, tok.column);

    if (ft == FieldType::Select || ft == FieldType::Radio || ft == FieldType::Checkbox) {
        if      (check(TokenType::LEFT_BRACE)) parseSelectOptions(*node);
        else if (check(TokenType::KW_FROM))    node->source = parseSourceBlock();
    }

    if (check(TokenType::KW_UI))       node->uiBlock        = parseUIBlock();
    if (check(TokenType::KW_VALIDATE)) node->validationBlock = parseValidationBlock();
    if (check(TokenType::KW_COMPUTE))  node->computeBlock   = parseComputeBlock();
    if (check(TokenType::KW_ON))       node->triggerBlock   = parseTriggerBlock();

    return node;
}

// ── §4: type ──────────────────────────────────────────────────────────────────
FieldType Parser::parseType() {
    switch (peek().type) {
        case TokenType::KW_TEXT:     advance(); return FieldType::Text;
        case TokenType::KW_INTEGER:  advance(); return FieldType::Integer;
        case TokenType::KW_FLOAT:    advance(); return FieldType::Float;
        case TokenType::KW_EMAIL:    advance(); return FieldType::Email;
        case TokenType::KW_DATE:     advance(); return FieldType::Date;
        case TokenType::KW_BOOLEAN:  advance(); return FieldType::Boolean;
        case TokenType::KW_URL:      advance(); return FieldType::Url;
        case TokenType::KW_SELECT:   advance(); return FieldType::Select;
        case TokenType::KW_RADIO:    advance(); return FieldType::Radio;
        case TokenType::KW_CHECKBOX: advance(); return FieldType::Checkbox;
        default:
            error(peek(), "Expected a field type (text, integer, float, email, "
                          "date, boolean, url, select, radio, checkbox)");
            return FieldType::Text;
    }
}

// ── §4: select options ────────────────────────────────────────────────────────
// EBNF: "{" option { option } "}"  where option = "option" STRING ;
void Parser::parseSelectOptions(FieldNode& field) {
    expect(TokenType::LEFT_BRACE, "Expected '{' to open options list");
    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        if (!check(TokenType::KW_OPTION)) {
            error(peek(), "Expected 'option' inside select/radio/checkbox block");
            synchronize();
            break;
        }
        advance();
        const Token& s = expect(TokenType::STRING, "Expected string after 'option'");
        field.options.push_back(stripQuotes(s.lexeme));
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close options list");
}

// ── §4: source_block ─────────────────────────────────────────────────────────
// EBNF: "from" ("url" STRING | "var" IDENTIFIER) [ "map" "{" ... "}" ] ;
std::unique_ptr<SourceBlockNode> Parser::parseSourceBlock() {
    const Token& fromTok = expect(TokenType::KW_FROM, "Expected 'from'");
    SourceKind sk; std::string src;

    if (check(TokenType::KW_URL)) {
        advance();
        sk = SourceKind::Url;
        const Token& u = expect(TokenType::STRING, "Expected URL string after 'from url'");
        src = stripQuotes(u.lexeme);
    } else if (check(TokenType::KW_VAR)) {
        advance();
        sk = SourceKind::Var;
        src = expectIdentifierLike().lexeme;
    } else {
        error(peek(), "Expected 'url' or 'var' after 'from'");
        return std::make_unique<SourceBlockNode>(SourceKind::Url, "", fromTok.line, fromTok.column);
    }

    auto node = std::make_unique<SourceBlockNode>(sk, std::move(src), fromTok.line, fromTok.column);

    if (check(TokenType::KW_MAP)) {
        advance();
        expect(TokenType::LEFT_BRACE, "Expected '{' after 'map'");
        const Token& lk = expectIdentifierLike();      // "label"
        expect(TokenType::COLON, "Expected ':' after label key in map");
        const Token& lv = expectIdentifierLike();
        expect(TokenType::COMMA, "Expected ',' in map block");
        expectIdentifierLike();                         // "value"
        expect(TokenType::COLON, "Expected ':' after value key in map");
        const Token& vv = expectIdentifierLike();
        expect(TokenType::RIGHT_BRACE, "Expected '}' to close map block");
        (void)lk;
        node->mapLabel = lv.lexeme;
        node->mapValue = vv.lexeme;
    }
    return node;
}

// ── §5: ui_block ─────────────────────────────────────────────────────────────
// EBNF: "ui" "{" { ui_rule } "}"
std::optional<UIBlockNode> Parser::parseUIBlock() {
    expect(TokenType::KW_UI, "Expected 'ui'");
    expect(TokenType::LEFT_BRACE, "Expected '{' after 'ui'");
    UIBlockNode ui;

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if (check(TokenType::KW_LABEL)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'label'");
            ui.label = stripQuotes(expect(TokenType::STRING, "Expected string after 'label:'").lexeme);
        } else if (check(TokenType::KW_PLACEHOLDER)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'placeholder'");
            ui.placeholder = stripQuotes(expect(TokenType::STRING, "Expected string after 'placeholder:'").lexeme);
        } else if (check(TokenType::KW_HELP_TEXT)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'helpText'");
            ui.helpText = stripQuotes(expect(TokenType::STRING, "Expected string after 'helpText:'").lexeme);
        } else if (check(TokenType::KW_DEFAULT)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'default'");
            ui.defaultValue = parseValue();
        } else if (check(TokenType::KW_BIND)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'bind'");
            ui.bind = stripQuotes(expect(TokenType::STRING, "Expected string after 'bind:'").lexeme);
        } else {
            error(peek(), "Unexpected token '" + peek().lexeme + "' in ui block");
            synchronize();
            break;
        }
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close ui block");
    return ui;
}

// ── §5: validation_block ─────────────────────────────────────────────────────
// EBNF: "validate" "{" { validation_rule } "}"
std::optional<ValidationBlockNode> Parser::parseValidationBlock() {
    expect(TokenType::KW_VALIDATE, "Expected 'validate'");
    expect(TokenType::LEFT_BRACE,  "Expected '{' after 'validate'");
    ValidationBlockNode vb;

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if (check(TokenType::KW_REQUIRED)) {
            advance(); vb.required = true;
        } else if (check(TokenType::KW_MIN)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'min'");
            vb.min = std::stod(expect(TokenType::NUMBER, "Expected number after 'min:'").lexeme);
        } else if (check(TokenType::KW_MAX)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'max'");
            vb.max = std::stod(expect(TokenType::NUMBER, "Expected number after 'max:'").lexeme);
        } else if (check(TokenType::KW_MIN_LENGTH)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'minLength'");
            vb.minLength = std::stod(expect(TokenType::NUMBER, "Expected number after 'minLength:'").lexeme);
        } else if (check(TokenType::KW_MAX_LENGTH)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'maxLength'");
            vb.maxLength = std::stod(expect(TokenType::NUMBER, "Expected number after 'maxLength:'").lexeme);
        } else if (check(TokenType::KW_PATTERN)) {
            advance();
            expect(TokenType::COLON, "Expected ':' after 'pattern'");
            vb.pattern = stripQuotes(expect(TokenType::STRING, "Expected string after 'pattern:'").lexeme);
        } else {
            error(peek(), "Unexpected token '" + peek().lexeme + "' in validate block");
            synchronize();
            break;
        }
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close validate block");
    return vb;
}

// ── §5: section ───────────────────────────────────────────────────────────────
// EBNF: section = "section" STRING "{" { statement } "}" ;
std::unique_ptr<SectionNode> Parser::parseSection() {
    const Token& tok  = expect(TokenType::KW_SECTION, "Expected 'section'");
    const Token& name = expect(TokenType::STRING,     "Expected section name string");
    expect(TokenType::LEFT_BRACE, "Expected '{' after section name");

    auto node = std::make_unique<SectionNode>(stripQuotes(name.lexeme), tok.line, tok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        auto stmt = parseStatement();
        if (stmt) node->statements.push_back(std::move(stmt));
        // FIX: if parseStatement errored without advancing, force skip one token.
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close section body");
    return node;
}

// ── §5: layout_block ──────────────────────────────────────────────────────────
// EBNF: layout_block = ("row" | "column") "{" { statement } "}" ;
std::unique_ptr<LayoutNode> Parser::parseLayoutBlock() {
    LayoutKind lk; int ln, col;
    if (check(TokenType::KW_ROW)) {
        const Token& t = advance(); lk = LayoutKind::Row;    ln = t.line; col = t.column;
    } else {
        const Token& t = expect(TokenType::KW_COLUMN, "Expected 'row' or 'column'");
        lk = LayoutKind::Column; ln = t.line; col = t.column;
    }
    expect(TokenType::LEFT_BRACE, "Expected '{' after layout keyword");

    auto node = std::make_unique<LayoutNode>(lk, ln, col);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        auto stmt = parseStatement();
        if (stmt) node->statements.push_back(std::move(stmt));
        // FIX: same guard as parseSection.
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close layout block");
    return node;
}

// ── §6: conditional ───────────────────────────────────────────────────────────
// EBNF: "if" condition "{" { statement } "}" [ "else" "{" { statement } "}" ] ;
std::unique_ptr<ConditionalNode> Parser::parseConditional() {
    const Token& tok = expect(TokenType::KW_IF, "Expected 'if'");
    auto cond = parseCondition();
    expect(TokenType::LEFT_BRACE, "Expected '{' after condition");

    auto node = std::make_unique<ConditionalNode>(std::move(cond), tok.line, tok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        auto stmt = parseStatement();
        if (stmt) node->thenStatements.push_back(std::move(stmt));
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close if body");

    if (match(TokenType::KW_ELSE)) {
        expect(TokenType::LEFT_BRACE, "Expected '{' after 'else'");
        while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
            std::size_t before = current_;
            auto stmt = parseStatement();
            if (stmt) node->elseStatements.push_back(std::move(stmt));
            if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
                advance();
        }
        expect(TokenType::RIGHT_BRACE, "Expected '}' to close else body");
    }
    return node;
}

// ── §6: condition precedence chain ────────────────────────────────────────────
// EBNF: condition = logic_term { "||" logic_term } ;
CondPtr Parser::parseCondition() {
    CondPtr left = parseLogicTerm();
    while (check(TokenType::OR)) {
        std::size_t rhsStart = current_;
        std::size_t diagBefore = diag_.count();
        const Token& op = advance();
        CondPtr right = parseLogicTerm();
        if (current_ == rhsStart && diag_.count() > diagBefore && !isAtEnd())
            advance();
        left = std::make_unique<BinaryCondNode>("||", std::move(left), std::move(right),
                                                op.line, op.column);
    }
    return left;
}

// EBNF: logic_term = logic_factor { "&&" logic_factor } ;
CondPtr Parser::parseLogicTerm() {
    CondPtr left = parseLogicFactor();
    while (check(TokenType::AND)) {
        std::size_t rhsStart = current_;
        std::size_t diagBefore = diag_.count();
        const Token& op = advance();
        CondPtr right = parseLogicFactor();
        if (current_ == rhsStart && diag_.count() > diagBefore && !isAtEnd())
            advance();
        left = std::make_unique<BinaryCondNode>("&&", std::move(left), std::move(right),
                                                op.line, op.column);
    }
    return left;
}

// EBNF: logic_factor = simple_condition | "(" condition ")" ;
CondPtr Parser::parseLogicFactor() {
    if (check(TokenType::LEFT_PAREN)) {
        advance();
        CondPtr inner = parseCondition();
        expect(TokenType::RIGHT_PAREN, "Expected ')' to close parenthesised condition");
        return inner;
    }
    return parseSimpleCondition();
}

// EBNF: simple_condition = IDENTIFIER comparator value ;
std::unique_ptr<SimpleCondNode> Parser::parseSimpleCondition() {
    const Token& fieldTok = expectIdentifierLike();
    std::string cmp;
    if      (check(TokenType::EQ))  { cmp = "=="; advance(); }
    else if (check(TokenType::NEQ)) { cmp = "!="; advance(); }
    else if (check(TokenType::LTE)) { cmp = "<="; advance(); }
    else if (check(TokenType::GTE)) { cmp = ">="; advance(); }
    else if (check(TokenType::LT))  { cmp = "<";  advance(); }
    else if (check(TokenType::GT))  { cmp = ">";  advance(); }
    else { error(peek(), "Expected a comparison operator (==, !=, <, >, <=, >=)"); cmp = "=="; }

    auto val = parseValue();
    return std::make_unique<SimpleCondNode>(fieldTok.lexeme, cmp, std::move(val),
                                            fieldTok.line, fieldTok.column);
}

// ── §6: compute_block ─────────────────────────────────────────────────────────
// EBNF: compute_block = "compute" "=" expression ;
std::unique_ptr<ComputeBlockNode> Parser::parseComputeBlock() {
    const Token& tok = expect(TokenType::KW_COMPUTE, "Expected 'compute'");
    expect(TokenType::EQUALS, "Expected '=' after 'compute'");
    auto expr = parseExpression();
    return std::make_unique<ComputeBlockNode>(std::move(expr), tok.line, tok.column);
}

// ── §6: expression precedence chain ──────────────────────────────────────────
// KNOWN GRAMMAR GAP: math_factor has no unary minus (per EBNF_grammar.md).
// `compute = -5` cannot parse. Implement exactly what the grammar specifies.
// Flag for grammar amendment before Stage 5.

// EBNF: expression = math_term { ("+" | "-") math_term } ;
ExprPtr Parser::parseExpression() {
    ExprPtr left = parseMathTerm();
    while (check(TokenType::PLUS) || check(TokenType::MINUS)) {
        std::size_t rhsStart = current_;
        std::size_t diagBefore = diag_.count();
        const Token& op = advance();
        ExprPtr right = parseMathTerm();
        if (current_ == rhsStart && diag_.count() > diagBefore && !isAtEnd())
            advance();
        left = std::make_unique<BinaryExprNode>(op.lexeme, std::move(left), std::move(right),
                                                op.line, op.column);
    }
    return left;
}

// EBNF: math_term = math_factor { ("*" | "/") math_factor } ;
ExprPtr Parser::parseMathTerm() {
    ExprPtr left = parseMathFactor();
    while (check(TokenType::STAR) || check(TokenType::SLASH)) {
        std::size_t rhsStart = current_;
        std::size_t diagBefore = diag_.count();
        const Token& op = advance();
        ExprPtr right = parseMathFactor();
        if (current_ == rhsStart && diag_.count() > diagBefore && !isAtEnd())
            advance();
        left = std::make_unique<BinaryExprNode>(op.lexeme, std::move(left), std::move(right),
                                                op.line, op.column);
    }
    return left;
}

// EBNF: math_factor = IDENTIFIER | NUMBER | "(" expression ")" ;
ExprPtr Parser::parseMathFactor() {
    if (check(TokenType::NUMBER)) {
        const Token& n = advance();
        return std::make_unique<NumberLiteralNode>(std::stod(n.lexeme), n.lexeme, n.line, n.column);
    }
    if (check(TokenType::LEFT_PAREN)) {
        advance();
        ExprPtr inner = parseExpression();
        expect(TokenType::RIGHT_PAREN, "Expected ')' to close expression");
        return inner;
    }
    const Token& id = expectIdentifierLike();
    return std::make_unique<IdentifierExprNode>(id.lexeme, id.line, id.column);
}

// ── §6: repeat_group ──────────────────────────────────────────────────────────
// EBNF: repeat_group = "repeat" "count" "=" IDENTIFIER "{" { field } "}" ;
std::unique_ptr<RepeatGroupNode> Parser::parseRepeatGroup() {
    const Token& tok = expect(TokenType::KW_REPEAT,  "Expected 'repeat'");
    expect(TokenType::KW_COUNT, "Expected 'count' after 'repeat'");
    expect(TokenType::EQUALS,   "Expected '=' after 'count'");
    const Token& ref = expectIdentifierLike();
    expect(TokenType::LEFT_BRACE, "Expected '{' to open repeat block");

    auto node = std::make_unique<RepeatGroupNode>(ref.lexeme, tok.line, tok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        if (check(TokenType::KW_FIELD)) {
            node->fields.push_back(parseField());
        } else {
            error(peek(), "Only 'field' declarations are allowed inside a repeat block");
            synchronize();
        }
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close repeat block");
    return node;
}

// ── §7: action_block ──────────────────────────────────────────────────────────
// EBNF: "action" "submit" "{" "endpoint" ":" STRING "method" ":" ("POST"|"PUT"|"PATCH") "}" ;
std::unique_ptr<ActionBlockNode> Parser::parseActionBlock() {
    const Token& tok = expect(TokenType::KW_ACTION, "Expected 'action'");
    expect(TokenType::KW_SUBMIT,    "Expected 'submit' after 'action'");
    expect(TokenType::LEFT_BRACE,   "Expected '{' after 'action submit'");
    expect(TokenType::KW_ENDPOINT,  "Expected 'endpoint' in action block");
    expect(TokenType::COLON,        "Expected ':' after 'endpoint'");
    std::string endpoint = stripQuotes(expect(TokenType::STRING, "Expected URL string").lexeme);
    expect(TokenType::KW_METHOD,    "Expected 'method' in action block");
    expect(TokenType::COLON,        "Expected ':' after 'method'");

    HttpMethod method = HttpMethod::Post;
    if      (check(TokenType::KW_POST))  { method = HttpMethod::Post;  advance(); }
    else if (check(TokenType::KW_PUT))   { method = HttpMethod::Put;   advance(); }
    else if (check(TokenType::KW_PATCH)) { method = HttpMethod::Patch; advance(); }
    else { error(peek(), "Expected HTTP method: POST, PUT, or PATCH"); }

    expect(TokenType::RIGHT_BRACE, "Expected '}' to close action block");
    return std::make_unique<ActionBlockNode>(std::move(endpoint), method, tok.line, tok.column);
}

// ── §7: trigger_block ─────────────────────────────────────────────────────────
// EBNF: "on" event_type "{" { action_statement } "}" ;
std::unique_ptr<TriggerBlockNode> Parser::parseTriggerBlock() {
    const Token& tok = expect(TokenType::KW_ON, "Expected 'on'");
    EventType et;
    if      (check(TokenType::KW_LOAD))   { et = EventType::Load;   advance(); }
    else if (check(TokenType::KW_CHANGE)) { et = EventType::Change; advance(); }
    else if (check(TokenType::KW_BLUR))   { et = EventType::Blur;   advance(); }
    else if (check(TokenType::KW_SUBMIT)) { et = EventType::Submit; advance(); }
    else { error(peek(), "Expected event type: load, change, blur, or submit"); et = EventType::Load; }

    expect(TokenType::LEFT_BRACE, "Expected '{' after event type");
    auto node = std::make_unique<TriggerBlockNode>(et, tok.line, tok.column);

    while (!isAtEnd() && !check(TokenType::RIGHT_BRACE)) {
        std::size_t before = current_;
        auto stmt = parseActionStatement();
        if (stmt) node->actions.push_back(std::move(stmt));
        if (current_ == before && !isAtEnd() && !check(TokenType::RIGHT_BRACE))
            advance();
    }
    expect(TokenType::RIGHT_BRACE, "Expected '}' to close trigger block");
    return node;
}

// ── §7: action_statement ──────────────────────────────────────────────────────
// EBNF: "hide"/"show"/"clear" "(" IDENTIFIER ")"
//      | "set" "(" IDENTIFIER "," value ")"
//      | "navigate" "(" STRING ")"
//      | "submit" "(" ")"
std::unique_ptr<ActionStatementNode> Parser::parseActionStatement() {
    ActionKind ak; int ln = peek().line, col = peek().column;
    std::string target; std::unique_ptr<ValueNode> setValue;

    if      (check(TokenType::KW_HIDE))     { ak = ActionKind::Hide;     advance(); }
    else if (check(TokenType::KW_SHOW))     { ak = ActionKind::Show;     advance(); }
    else if (check(TokenType::KW_CLEAR))    { ak = ActionKind::Clear;    advance(); }
    else if (check(TokenType::KW_SET))      { ak = ActionKind::Set;      advance(); }
    else if (check(TokenType::KW_NAVIGATE)) { ak = ActionKind::Navigate; advance(); }
    else if (check(TokenType::KW_SUBMIT))   { ak = ActionKind::Submit;   advance(); }
    else {
        error(peek(), "Expected action statement (hide, show, clear, set, navigate, submit)");
        synchronize();
        return nullptr;
    }

    expect(TokenType::LEFT_PAREN, "Expected '(' after action verb");

    switch (ak) {
        case ActionKind::Hide:
        case ActionKind::Show:
        case ActionKind::Clear:
            target = expectIdentifierLike().lexeme;
            break;
        case ActionKind::Set:
            target = expectIdentifierLike().lexeme;
            expect(TokenType::COMMA, "Expected ',' in set()");
            setValue = parseValue();
            break;
        case ActionKind::Navigate:
            target = stripQuotes(expect(TokenType::STRING, "Expected URL string in navigate()").lexeme);
            break;
        case ActionKind::Submit:
            break;
    }

    expect(TokenType::RIGHT_PAREN, "Expected ')' to close action statement");
    return std::make_unique<ActionStatementNode>(ak, std::move(target), std::move(setValue), ln, col);
}

// ── parseValue ────────────────────────────────────────────────────────────────
// EBNF: value = STRING | NUMBER | "true" | "false" | IDENTIFIER ;
std::unique_ptr<ValueNode> Parser::parseValue() {
    if (check(TokenType::STRING)) {
        const Token& t = advance();
        return std::make_unique<ValueNode>(ValueKind::StringLit, stripQuotes(t.lexeme), 0.0, t.line, t.column);
    }
    if (check(TokenType::NUMBER)) {
        const Token& t = advance();
        return std::make_unique<ValueNode>(ValueKind::NumberLit, t.lexeme, std::stod(t.lexeme), t.line, t.column);
    }
    if (check(TokenType::KW_TRUE)) {
        const Token& t = advance();
        return std::make_unique<ValueNode>(ValueKind::BoolTrue, "true", 0.0, t.line, t.column);
    }
    if (check(TokenType::KW_FALSE)) {
        const Token& t = advance();
        return std::make_unique<ValueNode>(ValueKind::BoolFalse, "false", 0.0, t.line, t.column);
    }
    if (check(TokenType::IDENTIFIER) || isSoftKeyword(peek().type)) {
        const Token& t = advance();
        return std::make_unique<ValueNode>(ValueKind::Identifier, t.lexeme, 0.0, t.line, t.column);
    }
    error(peek(), "Expected a value (string, number, true, false, or identifier)");
    return std::make_unique<ValueNode>(ValueKind::StringLit, "", 0.0, peek().line, peek().column);
}

} // namespace forml
