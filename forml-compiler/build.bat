@echo off
:: =============================================================================
::  build.bat  —  Direct g++ build for the Forml Compiler (all stages built so far)
::  Stages included: 0 (token/diagnostics), 1 (lexer), 2 (ast), 3 (parser),
::                   4 (semantic_analyzer), 5 (json_serializer),
::                   6 (forml_bridge) when present
::  Use this if CMake is not installed.
::  Requires: g++ (MSYS2 / MinGW / GCC 15) in PATH.
:: =============================================================================
::
::  USAGE (run from forml-compiler/ directory):
::    build.bat
::
::  OUTPUTS:
::    build\test_lexer.exe           — Stage 1 test driver
::    build\test_parser.exe          — Stage 3 test driver  (if parser sources exist)
::    build\test_semantic.exe        — Stage 4 test driver  (if semantic sources exist)
::    build\test_json_serializer.exe — Stage 5 test driver  (if serializer sources exist)
::    build\forml_compiler.exe       — Stage 6 native CLI   (if bridge sources exist)
::
:: =============================================================================

echo.
echo  === Forml Compiler Build ===
echo.

if not exist build mkdir build

:: ── Shared compiler flags ─────────────────────────────────────────────────────
set FLAGS=-std=c++17 -Wall -Wextra -Wshadow -Wpedantic -I include -I third_party

:: ── Shared source files (all stages built so far) ─────────────────────────────
set SHARED_SRCS=src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp

:: ── test_lexer (Stage 1) ──────────────────────────────────────────────────────
echo [1/5] Building test_lexer...
g++ %FLAGS% %SHARED_SRCS% tests/test_lexer.cpp -o build/test_lexer.exe
if %ERRORLEVEL% NEQ 0 ( echo  [FAILED] test_lexer & exit /b 1 )
echo  [OK] build\test_lexer.exe

:: ── test_parser (Stage 3) ─────────────────────────────────────────────────────
if exist src\parser.cpp (
    echo [2/5] Building test_parser...
    g++ %FLAGS% %SHARED_SRCS% src/parser.cpp tests/test_parser.cpp -o build/test_parser.exe
    if %ERRORLEVEL% NEQ 0 ( echo  [FAILED] test_parser & exit /b 1 )
    echo  [OK] build\test_parser.exe
) else (
    echo [2/5] Skipping test_parser (src\parser.cpp not found)
)

:: ── test_semantic (Stage 4) ───────────────────────────────────────────────────
if exist src\semantic_analyzer.cpp (
    echo [3/5] Building test_semantic...
    g++ %FLAGS% %SHARED_SRCS% src/parser.cpp src/semantic_analyzer.cpp tests/test_semantic.cpp -o build/test_semantic.exe
    if %ERRORLEVEL% NEQ 0 ( echo  [FAILED] test_semantic & exit /b 1 )
    echo  [OK] build\test_semantic.exe
) else (
    echo [3/5] Skipping test_semantic (src\semantic_analyzer.cpp not found)
)

:: -- test_json_serializer (Stage 5) -------------------------------------------
if exist src\json_serializer.cpp (
    echo [4/5] Building test_json_serializer...
    g++ %FLAGS% %SHARED_SRCS% src/parser.cpp src\json_serializer.cpp tests/test_json_serializer.cpp -o build/test_json_serializer.exe
    if %ERRORLEVEL% NEQ 0 ( echo  [FAILED] test_json_serializer & exit /b 1 )
    echo  [OK] build\test_json_serializer.exe
) else (
    echo [4/5] Skipping test_json_serializer (src\json_serializer.cpp not found)
)

:: -- forml_compiler (Stage 6) -------------------------------------------------
if exist src\forml_bridge.cpp (
    echo [5/5] Building forml_compiler...
    g++ %FLAGS% %SHARED_SRCS% src/parser.cpp src/semantic_analyzer.cpp src/json_serializer.cpp src/forml_bridge.cpp examples/main.cpp -o build/forml_compiler.exe
    if %ERRORLEVEL% NEQ 0 ( echo  [FAILED] forml_compiler & exit /b 1 )
    echo  [OK] build\forml_compiler.exe
) else (
    echo [5/5] Skipping forml_compiler (src\forml_bridge.cpp not found)
)

echo.
echo  Build complete.
echo.
echo  Run:
echo    cd build ^&^& .\test_lexer.exe
echo    cd build ^&^& .\test_parser.exe
echo    cd build ^&^& .\test_semantic.exe
echo    cd build ^&^& .\test_json_serializer.exe
echo    cd build ^&^& .\forml_compiler.exe ..\tests\fixtures\05_deep_nesting.forml
echo.
