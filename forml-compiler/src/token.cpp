// src/token.cpp - tokenTypeToString implementation.

#include "forml/token.hpp"

namespace forml {

std::string tokenTypeToString(TokenType type) {
    switch (type) {
        // ── §2 Structural keywords ──────────────────────────────────────────
        case TokenType::KW_FORM:        return "KW_FORM";
        case TokenType::KW_PAGE:        return "KW_PAGE";
        case TokenType::KW_GROUP:       return "KW_GROUP";
        case TokenType::KW_USE:         return "KW_USE";
        case TokenType::KW_VAR:         return "KW_VAR";
        case TokenType::KW_SECTION:     return "KW_SECTION";
        case TokenType::KW_FIELD:       return "KW_FIELD";

        // ── §4 Field types ───────────────────────────────────────────────────
        case TokenType::KW_TEXT:        return "KW_TEXT";
        case TokenType::KW_INTEGER:     return "KW_INTEGER";
        case TokenType::KW_FLOAT:       return "KW_FLOAT";
        case TokenType::KW_EMAIL:       return "KW_EMAIL";
        case TokenType::KW_DATE:        return "KW_DATE";
        case TokenType::KW_BOOLEAN:     return "KW_BOOLEAN";
        case TokenType::KW_URL:         return "KW_URL";
        case TokenType::KW_SELECT:      return "KW_SELECT";
        case TokenType::KW_RADIO:       return "KW_RADIO";
        case TokenType::KW_CHECKBOX:    return "KW_CHECKBOX";
        case TokenType::KW_OPTION:      return "KW_OPTION";

        // ── §4 Data sourcing ─────────────────────────────────────────────────
        case TokenType::KW_FROM:        return "KW_FROM";
        case TokenType::KW_MAP:         return "KW_MAP";
        case TokenType::KW_LABEL:       return "KW_LABEL";
        case TokenType::KW_VALUE:       return "KW_VALUE";

        // ── §5 UI / Validation blocks ────────────────────────────────────────
        case TokenType::KW_UI:          return "KW_UI";
        case TokenType::KW_VALIDATE:    return "KW_VALIDATE";
        case TokenType::KW_PLACEHOLDER: return "KW_PLACEHOLDER";
        case TokenType::KW_HELP_TEXT:   return "KW_HELP_TEXT";
        case TokenType::KW_DEFAULT:     return "KW_DEFAULT";
        case TokenType::KW_BIND:        return "KW_BIND";
        case TokenType::KW_REQUIRED:    return "KW_REQUIRED";
        case TokenType::KW_MIN:         return "KW_MIN";
        case TokenType::KW_MAX:         return "KW_MAX";
        case TokenType::KW_MIN_LENGTH:  return "KW_MIN_LENGTH";
        case TokenType::KW_MAX_LENGTH:  return "KW_MAX_LENGTH";
        case TokenType::KW_PATTERN:     return "KW_PATTERN";

        // ── §5 Layout ────────────────────────────────────────────────────────
        case TokenType::KW_ROW:         return "KW_ROW";
        case TokenType::KW_COLUMN:      return "KW_COLUMN";

        // ── §6 Logic / dynamics ──────────────────────────────────────────────
        case TokenType::KW_IF:          return "KW_IF";
        case TokenType::KW_ELSE:        return "KW_ELSE";
        case TokenType::KW_REPEAT:      return "KW_REPEAT";
        case TokenType::KW_COUNT:       return "KW_COUNT";
        case TokenType::KW_COMPUTE:     return "KW_COMPUTE";

        // ── §7 Actions / triggers ────────────────────────────────────────────
        case TokenType::KW_ACTION:      return "KW_ACTION";
        case TokenType::KW_SUBMIT:      return "KW_SUBMIT";
        case TokenType::KW_ON:          return "KW_ON";
        case TokenType::KW_LOAD:        return "KW_LOAD";
        case TokenType::KW_CHANGE:      return "KW_CHANGE";
        case TokenType::KW_BLUR:        return "KW_BLUR";
        case TokenType::KW_HIDE:        return "KW_HIDE";
        case TokenType::KW_SHOW:        return "KW_SHOW";
        case TokenType::KW_CLEAR:       return "KW_CLEAR";
        case TokenType::KW_SET:         return "KW_SET";
        case TokenType::KW_NAVIGATE:    return "KW_NAVIGATE";
        case TokenType::KW_ENDPOINT:    return "KW_ENDPOINT";
        case TokenType::KW_METHOD:      return "KW_METHOD";

        // ── HTTP method literals ─────────────────────────────────────────────
        case TokenType::KW_POST:        return "KW_POST";
        case TokenType::KW_PUT:         return "KW_PUT";
        case TokenType::KW_PATCH:       return "KW_PATCH";

        // ── Boolean literal keywords ─────────────────────────────────────────
        case TokenType::KW_TRUE:        return "KW_TRUE";
        case TokenType::KW_FALSE:       return "KW_FALSE";

        // ── User-defined tokens (variable content) ───────────────────────────
        case TokenType::IDENTIFIER:     return "IDENTIFIER";
        case TokenType::STRING:         return "STRING";
        case TokenType::NUMBER:         return "NUMBER";

        // ── Punctuation ──────────────────────────────────────────────────────
        case TokenType::LEFT_BRACE:     return "LEFT_BRACE";
        case TokenType::RIGHT_BRACE:    return "RIGHT_BRACE";
        case TokenType::LEFT_PAREN:     return "LEFT_PAREN";
        case TokenType::RIGHT_PAREN:    return "RIGHT_PAREN";
        case TokenType::COLON:          return "COLON";
        case TokenType::SEMICOLON:      return "SEMICOLON";
        case TokenType::COMMA:          return "COMMA";
        case TokenType::EQUALS:         return "EQUALS";

        // ── Arithmetic operators ─────────────────────────────────────────────
        case TokenType::PLUS:           return "PLUS";
        case TokenType::MINUS:          return "MINUS";
        case TokenType::STAR:           return "STAR";
        case TokenType::SLASH:          return "SLASH";

        // ── Comparison operators ─────────────────────────────────────────────
        case TokenType::EQ:             return "EQ";
        case TokenType::NEQ:            return "NEQ";
        case TokenType::LT:             return "LT";
        case TokenType::GT:             return "GT";
        case TokenType::LTE:            return "LTE";
        case TokenType::GTE:            return "GTE";

        // ── Logical operators ────────────────────────────────────────────────
        case TokenType::AND:            return "AND";
        case TokenType::OR:             return "OR";

        // ── Infrastructure ───────────────────────────────────────────────────
        case TokenType::END_OF_FILE:    return "END_OF_FILE";
        case TokenType::ERROR:          return "ERROR";

        // Defensive default: if a new TokenType is added to the enum but this
        // switch is not updated, we get a clear "UNKNOWN" instead of silent UB.
        default:                        return "UNKNOWN";
    }
}

} // namespace forml
