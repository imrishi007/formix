// =============================================================================
// 10_visitor_pattern.cpp
// Forml Compiler Curriculum — File 10
//
// TOPIC: The visitor pattern — how to walk the AST multiple times with
//        different logic (validation, pretty-printing, JSON serialisation)
//        without polluting the AST node classes.
//
// COMPILE: g++ -std=c++17 -Wall -o 10_visitor 10_visitor_pattern.cpp
// RUN:     ./10_visitor
//
// ⚠️  STATUS: SCAFFOLD — visitor methods will match YOUR Forml node types.
//
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  THE PROBLEM: You have an AST. Now you want to:
//    Pass 1: validate semantics (file 11)
//    Pass 2: serialise to JSON (file 12)
//    Pass 3 (future): generate a React form component
//
//  Naive approach: add virtual methods to every node class:
//    class FieldNode : public Node {
//        void validate();
//        void toJson();
//        void toReact();  ← now every node must implement this
//    };
//
//  Problem: every new pass requires touching ALL node classes.
//  For 20 node types × 10 passes = 200 methods to maintain.
//
//  THE VISITOR PATTERN SOLUTION:
//    • Keep nodes as "dumb data" (no logic methods)
//    • Put each pass in its own VISITOR class
//    • Nodes just implement: void accept(Visitor& v) { v.visit(*this); }
//
//  Adding a new pass = add one new Visitor class. No node changes needed.
//
// ── THE TWO SIDES OF THE VISITOR PATTERN ─────────────────────────────────────
//
//  1. The VISITOR interface (one visit() overload per node type):
//       class Visitor {
//       public:
//           virtual void visit(PageNode& node) = 0;
//           virtual void visit(FieldNode& node) = 0;
//           virtual void visit(GroupNode& node) = 0;
//           // ... one per concrete node type in YOUR Forml AST
//       };
//
//  2. The ACCEPT method on each node (identical boilerplate):
//       class PageNode : public Node {
//           // ... data fields ...
//           void accept(Visitor& v) override { v.visit(*this); }
//       };
//
//  3. A CONCRETE VISITOR:
//       class PrettyPrinter : public Visitor {
//           void visit(PageNode& n) override { std::cout << "Page: " << n.label; }
//           void visit(FieldNode& n) override { std::cout << "Field: " << n.name; }
//       };
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <memory>

// =============================================================================
// SECTION 1 — Minimal worked example with placeholder node types
// =============================================================================
//
//  This section demonstrates the PATTERN with generic nodes.
//  File 10 will be rewritten with your actual Forml node hierarchy after
//  files 03-09 are complete and tested.

// Forward declarations (needed because accept() refers to Visitor,
// and Visitor's methods refer to node types — circular dependency)
class PageNode;
class FieldNode;

// Abstract Visitor — one pure virtual method per node type
class Visitor {
public:
    virtual ~Visitor() = default;
    virtual void visit(PageNode& node) = 0;
    virtual void visit(FieldNode& node) = 0;
    // [PLACEHOLDER: one entry per Forml node type — GroupNode, ConditionalNode, etc.]
};

// Abstract node base with accept()
class Node {
public:
    virtual ~Node() = default;
    virtual void accept(Visitor& v) = 0;
    int line = 0, col = 0;
};

// Concrete node: PageNode (placeholder — real version in file 04)
class PageNode : public Node {
public:
    std::string              label;
    std::vector<std::unique_ptr<Node>> children;

    PageNode(std::string l) : label(std::move(l)) {}

    // accept() is the ONLY method that knows about Visitor.
    // This is the key: double dispatch.
    //   v.visit(*this) calls the overload for PageNode specifically.
    void accept(Visitor& v) override { v.visit(*this); }
};

// Concrete node: FieldNode (placeholder)
class FieldNode : public Node {
public:
    std::string name;
    std::string typeName;

    FieldNode(std::string n, std::string t)
        : name(std::move(n)), typeName(std::move(t)) {}

    void accept(Visitor& v) override { v.visit(*this); }
};

// =============================================================================
// SECTION 2 — A concrete visitor: PrettyPrinter
// =============================================================================

class PrettyPrinter : public Visitor {
    int indent_ = 0;

    void printIndent() {
        for (int i = 0; i < indent_; ++i) std::cout << "  ";
    }

public:
    void visit(PageNode& node) override {
        printIndent();
        std::cout << "page \"" << node.label << "\" {\n";
        indent_++;
        for (auto& child : node.children) {
            child->accept(*this);  // recurse into children via double dispatch
        }
        indent_--;
        printIndent();
        std::cout << "}\n";
    }

    void visit(FieldNode& node) override {
        printIndent();
        std::cout << "field " << node.name << ": " << node.typeName << "\n";
    }
};

// =============================================================================
// SECTION 3 — Another visitor: NodeCounter
// =============================================================================
//
//  Demonstrates that adding a NEW PASS requires only a new class.
//  No changes to PageNode or FieldNode.

class NodeCounter : public Visitor {
public:
    int pageCount  = 0;
    int fieldCount = 0;

    void visit(PageNode& node) override {
        pageCount++;
        for (auto& child : node.children) child->accept(*this);
    }
    void visit(FieldNode& node) override { fieldCount++; }
};

// =============================================================================
// SECTION 4 — Demo
// =============================================================================

int main() {
    // Build a tiny AST manually (in real code the Parser builds it)
    auto page = std::make_unique<PageNode>("Sign Up");
    page->children.push_back(std::make_unique<FieldNode>("username", "text"));
    page->children.push_back(std::make_unique<FieldNode>("email", "email"));
    page->children.push_back(std::make_unique<FieldNode>("age", "number"));

    std::cout << "=== Pretty Printer pass ===\n";
    PrettyPrinter printer;
    page->accept(printer);

    std::cout << "\n=== Node Counter pass ===\n";
    NodeCounter counter;
    page->accept(counter);
    std::cout << "Pages: " << counter.pageCount << "\n";
    std::cout << "Fields: " << counter.fieldCount << "\n";

    std::cout << "\nKey insight: two passes, zero changes to PageNode or FieldNode.\n";
    std::cout << "[Full visitor with all Forml node types after your EBNF.]\n";
    return 0;
}

// =============================================================================
// TRY THIS
// =============================================================================
//
//  1. ADD A GroupNode
//     Create a GroupNode class similar to PageNode (it has a label and
//     children). Add visit(GroupNode&) to the Visitor interface.
//     Update PrettyPrinter and NodeCounter to handle it.
//     Note how every existing visitor MUST implement the new overload
//     because it's pure virtual — the compiler enforces completeness.
//
//  2. DEPTH-TRACKING VISITOR
//     Create a MaxDepthVisitor that walks the tree and records the maximum
//     nesting depth reached. Use a stack or a depth counter.
//
//  3. WHY IS THIS "DOUBLE DISPATCH"?
//     Regular virtual dispatch: which method to call depends on the TYPE
//     of ONE object (the node). Double dispatch: depends on the type of
//     TWO objects (the node AND the visitor). Write a comment explaining
//     step by step what happens when you call page->accept(printer).
//
// =============================================================================
