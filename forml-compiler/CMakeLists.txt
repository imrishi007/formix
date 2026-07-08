# =============================================================================
#  CMakeLists.txt
#  Forml Compiler — Stage 0 + Stage 1 Build
# =============================================================================
#
#  PURPOSE
#  -------
#  CMake is a build-system generator.  It reads this file and produces native
#  build files (Makefiles, Ninja files, Visual Studio projects, etc.) for your
#  platform.  You then use those native files to actually compile the code.
#
#  WHY CMake instead of a raw Makefile?
#  CMake is cross-platform and is the de-facto standard for C++ projects.
#  It handles include paths, library linking, and compiler flags uniformly
#  across Windows/Linux/macOS.  When we add WASM support (Stage 6) we can
#  add an Emscripten toolchain file without rewriting the whole build.
#
#  WHAT THIS FILE BUILDS (Stages 0 through 6)
#  ------------------------------------------
#  Five executables:
#    test_lexer   — Stage 1 lexer review tool
#    test_parser  — Stage 3 parser review tool
#    test_semantic — Stage 4 semantic analyzer review tool
#    test_json_serializer — Stage 5 serializer review tool
#    forml_compiler — Stage 6 native bridge CLI
#
#  WASM/Emscripten stays out of the native build. The embind source lives in
#  wasm/bindings.cpp and is compiled with the Emscripten toolchain separately.
#
#  HOW TO BUILD
#  ------------
#  (Windows with MSYS2/MinGW, cmake installed)
#
#    cd forml-compiler
#    mkdir build
#    cd build
#    cmake .. -G "MinGW Makefiles"
#    cmake --build .
#    .\test_lexer.exe
#
#  (Linux/macOS)
#
#    cd forml-compiler
#    mkdir build && cd build
#    cmake .. -G "Ninja"          # or omit -G for default Makefiles
#    cmake --build .
#    ./test_lexer
#
#  Alternatively use the provided build.bat (Windows) or build.sh (Unix)
#  for a one-command direct g++ build that requires no CMake installation.
#
# =============================================================================

cmake_minimum_required(VERSION 3.16)

# Project declaration.
# VERSION follows semantic versioning: MAJOR.MINOR.PATCH
# LANGUAGES tells CMake we only use C++ (no C or Fortran).
project(FormlCompiler VERSION 0.1.0 LANGUAGES CXX)

# Require C++17.
# WHY C++17?
#   • std::string_view  (efficient substring views, useful in the lexer later)
#   • if-with-initializer  (cleaner scope control)
#   • Structured bindings  (cleaner pair/tuple unpacking in the parser)
# C++14 would also work for Stage 0+1, but setting 17 now avoids a later bump.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)   # Use -std=c++17 not -std=gnu++17

# =============================================================================
#  Compiler warnings
# =============================================================================
#  Warnings are compile-time diagnostics from the compiler itself — they catch
#  common mistakes before they become runtime bugs.  We enable a generous set.
#
#  -Wall    — a curated "wall" of useful warnings (not literally ALL warnings)
#  -Wextra  — extra warnings beyond -Wall
#  -Wshadow — warn when a local variable shadows an outer variable
#  -Wconversion — warn on implicit type conversions that may lose data
#  /W4      — MSVC equivalent of -Wall -Wextra
# =============================================================================

if (MSVC)
    add_compile_options(/W4 /WX)
else()
    add_compile_options(
        -Wall
        -Wextra
        -Wshadow
        -Wconversion
        -Wpedantic
        # -Werror   ← uncomment to treat all warnings as errors (strict mode)
    )
endif()

# =============================================================================
#  Include paths
# =============================================================================
#  By adding include/ as an include directory, any file in the project can
#  write:
#    #include "forml/token.hpp"
#  and the compiler will find it at include/forml/token.hpp.
#
#  We also add third_party/ so:
#    #include "nlohmann/json.hpp"
#  resolves to third_party/nlohmann/json.hpp.
#  (nlohmann/json is not used in Stage 0+1, but adding the path now means
#  no CMakeLists.txt change will be needed when Stage 5 uses it.)
# =============================================================================

include_directories(
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_SOURCE_DIR}/third_party
)

# =============================================================================
#  Compiler library (static library of shared compilation units)
# =============================================================================
#  We compile the core compiler sources into a static library called
#  "forml_compiler_lib".  The test executable then links against this library.
#
#  WHY a library instead of compiling the .cpp files directly into the test?
#  When we add more executables (examples/main.cpp, a future CLI entry point,
#  WASM bindings) they all share the same token/lexer/parser code.  A library
#  lets each executable link the shared code without recompiling it.
# =============================================================================

add_library(forml_compiler_lib STATIC
    src/token.cpp
    src/diagnostics.cpp
    src/lexer.cpp
    src/ast.cpp
    src/parser.cpp
    src/semantic_analyzer.cpp
    src/json_serializer.cpp
    src/forml_bridge.cpp
)

# Make include paths available to anything that links forml_compiler_lib.
# INTERFACE means "anyone linking this library also inherits these includes".
target_include_directories(forml_compiler_lib
    PUBLIC
        ${CMAKE_SOURCE_DIR}/include
        ${CMAKE_SOURCE_DIR}/third_party
)

# =============================================================================
#  test_lexer executable
# =============================================================================
#  The Stage 1 test driver: reads fixture files and prints token tables.
# =============================================================================

add_executable(test_lexer
    tests/test_lexer.cpp
)

# Link against the shared compiler library.
target_link_libraries(test_lexer PRIVATE forml_compiler_lib)

# =============================================================================
#  test_parser executable
# =============================================================================

add_executable(test_parser
    tests/test_parser.cpp
)

target_link_libraries(test_parser PRIVATE forml_compiler_lib)

# =============================================================================
#  test_semantic executable
# =============================================================================

add_executable(test_semantic
    tests/test_semantic.cpp
)

target_link_libraries(test_semantic PRIVATE forml_compiler_lib)

# =============================================================================
#  test_json_serializer executable
# =============================================================================

add_executable(test_json_serializer
    tests/test_json_serializer.cpp
)

target_link_libraries(test_json_serializer PRIVATE forml_compiler_lib)

# =============================================================================
#  forml_compiler executable
# =============================================================================

add_executable(forml_compiler
    examples/main.cpp
)

target_link_libraries(forml_compiler PRIVATE forml_compiler_lib)

# =============================================================================
#  WASM note
# =============================================================================
#
#  Build wasm/bindings.cpp with Emscripten separately, for example:
#    emcc --bind -std=c++17 -I include -I third_party \
#      src/token.cpp src/diagnostics.cpp src/lexer.cpp src/ast.cpp \
#      src/parser.cpp src/semantic_analyzer.cpp src/json_serializer.cpp \
#      src/forml_bridge.cpp wasm/bindings.cpp -o forml.js
#
# =============================================================================
