// src/lexer.cpp - Forml lexer implementation.

#include "forml/lexer.hpp"

#include <cctype>    // isalpha, isdigit, isspace — standard C character tests
#include <sstream>   // std::ostringstream for error message building

namespace forml {

// Static keyword table.

// clang-format off
const std::unordered_map<std::string, TokenType> Lexer::keywords_ = {
    // §2 Structural keywords
    { "form",        TokenType::KW_FORM        },
    { "page",        TokenType::KW_PAGE        },
    { "group",       TokenType::KW_GROUP       },
    { "use",         TokenType::KW_USE         },
    { "var",         TokenType::KW_VAR         },
    { "section",     TokenType::KW_SECTION     },
    { "field",       TokenType::KW_FIELD       },

    // §4 Field types
    { "text",        TokenType::KW_TEXT        },
    { "integer",     TokenType::KW_INTEGER     },
    { "float",       TokenType::KW_FLOAT       },
    { "email",       TokenType::KW_EMAIL       },
    { "date",        TokenType::KW_DATE        },
    { "boolean",     TokenType::KW_BOOLEAN     },
    { "url",         TokenType::KW_URL         },
    { "select",      TokenType::KW_SELECT      },
    { "radio",       TokenType::KW_RADIO       },
    { "checkbox",    TokenType::KW_CHECKBOX    },
    { "option",      TokenType::KW_OPTION      },

    // §4 Data sourcing
    { "from",        TokenType::KW_FROM        },
    { "map",         TokenType::KW_MAP         },
    { "label",       TokenType::KW_LABEL       },
    { "value",       TokenType::KW_VALUE       },

    // §5 UI / Validation blocks
    { "ui",          TokenType::KW_UI          },
    { "validate",    TokenType::KW_VALIDATE    },
    { "placeholder", TokenType::KW_PLACEHOLDER },
    { "helpText",    TokenType::KW_HELP_TEXT   },
    { "default",     TokenType::KW_DEFAULT     },
    { "bind",        TokenType::KW_BIND        },
    { "required",    TokenType::KW_REQUIRED    },
    { "min",         TokenType::KW_MIN         },
    { "max",         TokenType::KW_MAX         },
    { "minLength",   TokenType::KW_MIN_LENGTH  },
    { "maxLength",   TokenType::KW_MAX_LENGTH  },
    { "pattern",     TokenType::KW_PATTERN     },

    // §5 Layout
    { "row",         TokenType::KW_ROW         },
    { "column",      TokenType::KW_COLUMN      },

    // §6 Logic / dynamics
    { "if",          TokenType::KW_IF          },
    { "else",        TokenType::KW_ELSE        },
    { "repeat",      TokenType::KW_REPEAT      },
    { "count",       TokenType::KW_COUNT       },
    { "compute",     TokenType::KW_COMPUTE     },

    // §7 Actions / triggers
    { "action",      TokenType::KW_ACTION      },
    { "submit",      TokenType::KW_SUBMIT      },
    { "on",          TokenType::KW_ON          },
    { "load",        TokenType::KW_LOAD        },
    { "change",      TokenType::KW_CHANGE      },
    { "blur",        TokenType::KW_BLUR        },
    { "hide",        TokenType::KW_HIDE        },
    { "show",        TokenType::KW_SHOW        },
    { "clear",       TokenType::KW_CLEAR       },
    { "set",         TokenType::KW_SET         },
    { "navigate",    TokenType::KW_NAVIGATE    },
    { "endpoint",    TokenType::KW_ENDPOINT    },
    { "method",      TokenType::KW_METHOD      },

    // HTTP method literals (uppercase — treated as reserved keywords)
    { "POST",        TokenType::KW_POST        },
    { "PUT",         TokenType::KW_PUT         },
    { "PATCH",       TokenType::KW_PATCH       },

    // Boolean literal keywords
    { "true",        TokenType::KW_TRUE        },
    { "false",       TokenType::KW_FALSE       },
};
// clang-format on


Lexer::Lexer(const std::string& source, DiagnosticEngine& diag)
    : source_(source)
    , diag_(diag)
    , start_(0)
    , current_(0)
    , line_(1)
    , column_(1)
    , tokenStartLine_(1)
    , tokenStartColumn_(1)
{}


// Character classification helpers.

static bool isAlpha(char c) {
    return std::isalpha(static_cast<unsigned char>(c)) != 0;
}

static bool isDigit(char c) {
    return std::isdigit(static_cast<unsigned char>(c)) != 0;
}

static bool isAlphaNumericOrUnderscore(char c) {
    return isAlpha(c) || isDigit(c) || c == '_';
}


bool Lexer::isAtEnd() const {
    return current_ >= source_.size();
}

char Lexer::peek() const {
    if (isAtEnd()) return '\0';
    return source_[current_];
}

char Lexer::peekNext() const {
    if (current_ + 1 >= source_.size()) return '\0';
    return source_[current_ + 1];
}

char Lexer::advance() {
    char c = source_[current_];
    current_++;

    if (c == '\n') {
        line_++;
        column_ = 1;
    } else {
        column_++;
    }

    return c;
}

bool Lexer::match(char expected) {
    if (isAtEnd()) return false;
    if (source_[current_] != expected) return false;
    advance();
    return true;
}

Token Lexer::makeToken(TokenType type) {
    std::string lexeme = source_.substr(start_, current_ - start_);
    return Token{ type, std::move(lexeme), tokenStartLine_, tokenStartColumn_ };
}


void Lexer::skipWhitespaceAndComments() {
    while (!isAtEnd()) {
        char c = peek();

        if (c == ' ' || c == '\t' || c == '\r' || c == '\n') {
            advance();

        } else if (c == '/' && peekNext() == '/') {
            while (!isAtEnd() && peek() != '\n') {
                advance();
            }

        } else {
            break;
        }
    }
}


Token Lexer::scanIdentifierOrKeyword() {
    while (!isAtEnd() && isAlphaNumericOrUnderscore(peek())) {
        advance();
    }

    std::string text = source_.substr(start_, current_ - start_);

    auto it = keywords_.find(text);
    if (it != keywords_.end()) {
        return makeToken(it->second);
    }

    return makeToken(TokenType::IDENTIFIER);
}


Token Lexer::scanString() {
    advance();

    while (!isAtEnd() && peek() != '"') {
        if (peek() == '\n') {
            diag_.error(
                "Unterminated string literal: newline inside string is not allowed. "
                "Did you forget a closing '\"'?",
                tokenStartLine_, tokenStartColumn_
            );
            return makeToken(TokenType::ERROR);
        }
        advance();
    }

    if (isAtEnd()) {
        diag_.error(
            "Unterminated string literal: reached end of file before closing '\"'.",
            tokenStartLine_, tokenStartColumn_
        );
        return makeToken(TokenType::ERROR);
    }

    advance();

    return makeToken(TokenType::STRING);
}


Token Lexer::scanNumber() {
    while (!isAtEnd() && isDigit(peek())) {
        advance();
    }

    if (peek() == '.' && isDigit(peekNext())) {
        advance();

        while (!isAtEnd() && isDigit(peek())) {
            advance();
        }
    }

    return makeToken(TokenType::NUMBER);
}


std::vector<Token> Lexer::tokenize() {
    std::vector<Token> tokens;

    while (!isAtEnd()) {

        skipWhitespaceAndComments();

        if (isAtEnd()) break;

        start_ = current_;
        tokenStartLine_    = line_;
        tokenStartColumn_  = column_;

        char c = advance();

        Token tok = [&]() -> Token {
            switch (c) {

                case '{': return makeToken(TokenType::LEFT_BRACE);
                case '}': return makeToken(TokenType::RIGHT_BRACE);
                case '(': return makeToken(TokenType::LEFT_PAREN);
                case ')': return makeToken(TokenType::RIGHT_PAREN);
                case ':': return makeToken(TokenType::COLON);
                case ';': return makeToken(TokenType::SEMICOLON);
                case ',': return makeToken(TokenType::COMMA);
                case '+': return makeToken(TokenType::PLUS);
                case '-': return makeToken(TokenType::MINUS);
                case '*': return makeToken(TokenType::STAR);

                case '/': return makeToken(TokenType::SLASH);

                case '=':
                    if (match('=')) return makeToken(TokenType::EQ);
                    return makeToken(TokenType::EQUALS);

                case '!':
                    if (match('=')) return makeToken(TokenType::NEQ);
                    diag_.error(
                        std::string("Unexpected character '!'. Did you mean '!='?"),
                        tokenStartLine_, tokenStartColumn_
                    );
                    return makeToken(TokenType::ERROR);

                case '<':
                    if (match('=')) return makeToken(TokenType::LTE);
                    return makeToken(TokenType::LT);

                case '>':
                    if (match('=')) return makeToken(TokenType::GTE);
                    return makeToken(TokenType::GT);

                case '&':
                    if (match('&')) return makeToken(TokenType::AND);
                    diag_.error(
                        std::string("Unexpected character '&'. Did you mean '&&'?"),
                        tokenStartLine_, tokenStartColumn_
                    );
                    return makeToken(TokenType::ERROR);

                case '|':
                    if (match('|')) return makeToken(TokenType::OR);
                    diag_.error(
                        std::string("Unexpected character '|'. Did you mean '||'?"),
                        tokenStartLine_, tokenStartColumn_
                    );
                    return makeToken(TokenType::ERROR);

                case '"':
                    return scanString();

                default:
                    if (isDigit(c)) {
                        return scanNumber();
                    }

                    if (isAlpha(c)) {
                        return scanIdentifierOrKeyword();
                    }

                    {
                        std::ostringstream msg;
                        if (c >= 32 && c < 127) {
                            msg << "Unexpected character '" << c << "'.";
                        } else {
                            msg << "Unexpected character (hex 0x"
                                << std::hex << static_cast<int>(static_cast<unsigned char>(c))
                                << ").";
                        }
                        diag_.error(msg.str(), tokenStartLine_, tokenStartColumn_);
                        return makeToken(TokenType::ERROR);
                    }
            }
        }();  // immediately-invoked lambda so we can use a local `return`

        tokens.push_back(std::move(tok));
    }

    tokens.push_back(Token{
        TokenType::END_OF_FILE,
        "",
        line_,
        column_
    });

    return tokens;
}

} // namespace forml
