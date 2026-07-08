# Forml Compiler Analysis

## Stage 3 Summary

- The repetition-loop no-progress fix is present and `01` through `06` parse without hanging.
- The precedence-climbing no-progress guard is now applied across `parseCondition`, `parseLogicTerm`, `parseExpression`, and `parseMathTerm`, so malformed operator chains no longer spin on a stuck token.
- The unary-minus gap remains unresolved. `math_factor` in `EBNF_grammar.md` still has no unary minus, so `compute = -5` is still not parseable.
- No additional grammar ambiguity was required for the precedence-climbing chains beyond that gap. `condition`/`logic_term`/`logic_factor` and `expression`/`math_term`/`math_factor` remain standard left-associative binary chains.
- Build and run for `test_parser.cpp`:
  - Compile from `forml-compiler/` with:

```bash
g++ -std=c++17 -Wall -Wextra -Wshadow -Wpedantic -I include -I third_party src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp src/parser.cpp tests/test_parser.cpp -o build/test_parser.exe
```

  - Run from `forml-compiler/build/`:

```bash
test_parser.exe
```

## Stage 4 Summary

- Implemented exactly as specified:
  - Duplicate field names within a local statement scope.
  - Duplicate group names, var names, and page names at form scope.
  - Undefined references in simple conditions, math expressions, and `group_use`.
  - `var_declaration` literal-only enforcement.
  - Validation/type compatibility checks for `min`/`max` and `minLength`/`maxLength`/`pattern`.
  - `repeat count = IDENTIFIER` resolution against declared field or var names.
- `01_strings_and_numbers.forml` and `02_nested_braces.forml` are lexer/parser-only fixtures. Their three semantic diagnostics each are expected undefined-reference outcomes for undeclared names, so the fixtures are now annotated to make that intent explicit.
- Scoped as a deliberate design decision:
  - Identifier references are resolved against whole-form name tables (`allFields_` and `varNames_`) regardless of where they are referenced.
  - Duplicate-declaration checks remain local to the current block, except for form-level group/var/page declarations.
- Out of scope and not implemented:
  - Cross-page `navigate()` target validation.
- Build and run for `test_semantic.cpp`:
  - Compile from `forml-compiler/` with:

```bash
g++ -std=c++17 -Wall -Wextra -Wshadow -Wpedantic -I include -I third_party src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp src/parser.cpp src/semantic_analyzer.cpp tests/test_semantic.cpp -o build/test_semantic.exe
```

  - Run from `forml-compiler/build/`:

```bash
test_semantic.exe
```

## Regression Table

| Fixture | Lexer | Parser | Semantic |
| --- | --- | --- | --- |
| `01_strings_and_numbers.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `3` diagnostics |
| `02_nested_braces.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `3` diagnostics |
| `03_bad_characters.forml` | fail, `6` diagnostics | skipped after lexer errors | skipped after lexer errors |
| `04_soft_keyword_names.forml` | pass, `0` diagnostics | pass, `0` diagnostics | pass, `0` diagnostics |
| `05_deep_nesting.forml` | pass, `0` diagnostics | pass, `0` diagnostics | pass, `0` diagnostics |
| `06_malformed.forml` | pass, `0` diagnostics | fail, `5` diagnostics | skipped after parser errors |
| `07_duplicate_field.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `1` diagnostic |
| `08_undefined_reference.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `1` diagnostic |
| `09_var_with_identifier.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `1` diagnostic |
| `10_validation_type_mismatch.forml` | pass, `0` diagnostics | pass, `0` diagnostics | fail, `1` diagnostic |
| `11_malformed_expression.forml` | pass, `0` diagnostics | fail, `4` diagnostics | skipped after parser errors |

## Regression Findings

- `src/parser.cpp::parseCondition`, `parseLogicTerm`, `parseExpression`, and `parseMathTerm` now use the same no-progress guard as the earlier block-repetition loops, so malformed precedence chains such as `a + * b` terminate with diagnostics instead of hanging.
- `build.bat` is not reliable in this shell because `cmd` chokes on the file's encoded comment glyphs. Direct `g++` builds succeed and were used for verification.
- The test drivers are cwd-sensitive and expect to run from `forml-compiler/build/` because they use `../tests/...` fixture paths.

## Total Count

Regression pass total: `25` diagnostics plus `2` catalogued build/deferred issues, for `27` actionable items.

## Stage 5-6 Pipeline Check

- Native bridge executable built successfully from `examples/main.cpp` plus the full compiler pipeline sources.
- Full end-to-end runs through `compileForml()` on all 11 fixtures produced JSON output for every file, including malformed inputs.
- `success` was `true` only for the fully clean fixtures: `04_soft_keyword_names.forml` and `05_deep_nesting.forml`.
- `ast` was present for every fixture, including malformed ones, because the bridge keeps best-effort AST output whenever parsing returns a root node.
- Error fixtures still emitted diagnostics in the unified bridge response:
  - `01_strings_and_numbers.forml`: 3 errors
  - `02_nested_braces.forml`: 3 errors
  - `03_bad_characters.forml`: 18 errors
  - `06_malformed.forml`: 5 errors
  - `07_duplicate_field.forml`: 1 error
  - `08_undefined_reference.forml`: 1 error
  - `09_var_with_identifier.forml`: 1 error
  - `10_validation_type_mismatch.forml`: 1 error
  - `11_malformed_expression.forml`: 9 errors
- The malformed fixtures still produced partial ASTs instead of failing closed, which matches the current bridge design and is useful for frontend preview behavior.
- JsonSerializer reentrancy bug and fix:
  - What broke: the serializer's shared member `current_` was used as both scratch space and the return channel for `serializeNode()`. Parent visitors such as `FormNode`, `PageNode`, and `FieldNode` built their JSON object directly into `current_`, then called `serializeNode()` on children. Each child overwrote `current_`, so the parent lost its partially built object when control returned. The visible symptom was deep trees collapsing to the last child serialized, initially seen on `02_nested_braces.forml` and `05_deep_nesting.forml`, both of which temporarily serialized to only an `ActionBlock`.
  - Fix: parent-side visitors now build a local `nlohmann::json` object, serialize children into that local object, and assign `current_ = std::move(json)` once at the end.
  - Confirmation: after the fix, all 11 fixtures were rerun through `test_json_serializer.cpp`, and no other silent mis-serializations were found.
