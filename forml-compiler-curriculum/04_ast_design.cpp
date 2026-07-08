// =============================================================================
// 04_ast_design.cpp
// Forml Compiler Curriculum — File 04
//
// TOPIC: Designing AST (Abstract Syntax Tree) node classes.
//        Base class + virtual dispatch. Why nodes are "dumb data".
//        Ownership with std::unique_ptr.
//
// COMPILE: g++ -std=c++17 -Wall -o 04_ast 04_ast_design.cpp
// RUN:     ./04_ast
//
// ⚠️  STATUS: SCAFFOLD — node types will match YOUR Forml grammar.
//
// This file defines the data structure that lives between the parser and
// every downstream pass (validation, serialisation, code generation).
// The node hierarchy will be completed using your actual Forml constructs.
// =============================================================================
//
// ── WHAT YOU'LL LEARN ────────────────────────────────────────────────────────
//
//  1. What an AST is and why it's different from a parse tree (CST)
//
//  2. The base class pattern for AST nodes:
//       class Node — abstract base with virtual destructor
//       class PageNode : public Node — a concrete node
//
//  3. Why nodes should be "dumb data containers":
//       They hold fields. They do NOT have methods like "typecheck()" or
//       "serialize()". Logic lives in separate visitor passes (file 10+).
//       This keeps the tree itself stable while passes can be added freely.
//
//  4. std::unique_ptr for ownership:
//       Who owns an AST node? The PARENT node. unique_ptr encodes this:
//       deleting a parent recursively deletes all children automatically.
//       This avoids manual delete chains and memory leaks.
//
//  5. NodeKind enum for cheap type inspection without dynamic_cast:
//       Sometimes you need to quickly check "is this a FieldNode?"
//       Virtual dispatch via if/else chains of dynamic_cast is fragile.
//       A NodeKind enum lets you switch() on node type cheaply.
//
// =============================================================================

#include <iostream>
#include <string>
#include <vector>
#include <memory>    // std::unique_ptr
#include <cassert>

// =============================================================================
// SECTION 1 — NodeKind enum
// =============================================================================
//
//  [PLACEHOLDER: Once you paste your grammar, this will contain the complete
//   set of node kinds for Forml:
//
//   enum class NodeKind {
//       Program,
//       Page,
//       Field,
//       Group,
//       Conditional,
//       ComputedField,
//       ActionBlock,
//       FieldType,
//       // ... etc, one per grammar construct that becomes a tree node
//   };
//
//  The design question "which grammar constructs need their own AST node?"
//  will be answered for your specific grammar.]

enum class NodeKind {
    // Root
    Program,

    // [PLACEHOLDER — will be expanded from your grammar]
    // Page,
    // Field,
    // Group,
    // Conditional,
    // ComputedField,
    // ActionBlock,
    // FieldType,
    // ...

    // Placeholder sentinel
    Unknown,
};

// =============================================================================
// SECTION 2 — Abstract base class: Node
// =============================================================================
//
//  WHY abstract base class?
//    The parser returns a mix of PageNode, FieldNode, GroupNode, etc.
//    The visitor (file 10) needs to accept all of them through one interface.
//    A common base class makes this possible.
//
//  WHY virtual destructor?
//    If you delete a Node* that actually points to a PageNode, without a
//    virtual destructor, only ~Node() runs — not ~PageNode(). Memory leak!
//    Virtual destructor ensures the MOST DERIVED destructor is called.

class Node {
public:
    NodeKind kind;    // cheap type tag — avoids most dynamic_cast usage
    int      line;    // source line where this construct started (for error messages)
    int      col;     // source column

    // Constructor initialises the common fields
    Node(NodeKind k, int line, int col) : kind(k), line(line), col(col) {}

    // Pure virtual destructor makes Node abstract (can't instantiate it directly)
    // but we still define it (= default) so derived destructors can call it.
    virtual ~Node() = default;

    // We do NOT add a virtual print() or serialize() here.
    // Those live in visitor classes (file 10).
    // WHY? Because if you add 5 operations to the base class, every time you
    // add a new node type you must implement all 5 operations. With visitors,
    // you add one new visitor for each new operation — much more manageable.
};

// Convenient alias: most of the time we own nodes through unique_ptr
using NodePtr = std::unique_ptr<Node>;

// =============================================================================
// SECTION 3 — Concrete node types
// =============================================================================
//
//  [PLACEHOLDER: These will be filled in from your grammar. Examples of what
//   they'll look like:
//
//   // A 'page' declaration
//   class PageNode : public Node {
//   public:
//       std::string label;                    // the quoted display name
//       std::vector<NodePtr> declarations;    // fields, groups, etc. inside {}
//
//       PageNode(std::string label, std::vector<NodePtr> decls, int line, int col)
//           : Node(NodeKind::Page, line, col)
//           , label(std::move(label))
//           , declarations(std::move(decls))
//       {}
//   };
//
//   // A 'field' declaration
//   class FieldNode : public Node {
//   public:
//       std::string name;      // identifier
//       std::string typeName;  // e.g. "text", "number", "boolean"
//       // ... options, constraints, label override, etc.
//       FieldNode(...) : Node(NodeKind::Field, line, col) { ... }
//   };
//
//   Each node type holds exactly the data its grammar rule produces.
//   Nothing more, nothing less.]

// Placeholder node just to make the file compile and run
class PlaceholderNode : public Node {
public:
    std::string name;

    PlaceholderNode(std::string n, int line, int col)
        : Node(NodeKind::Unknown, line, col), name(std::move(n)) {}
};

// =============================================================================
// SECTION 4 — unique_ptr ownership demonstration
// =============================================================================
//
//  This section shows why unique_ptr is the right ownership model for AST nodes
//  and how to build a tree from them.

void demonstrateOwnership() {
    std::cout << "=== Ownership demonstration ===\n\n";

    // Creating a node: unique_ptr ensures automatic cleanup
    // make_unique<T>(args...) is the preferred way (never use raw 'new')
    auto root = std::make_unique<PlaceholderNode>("Program", 1, 1);
    auto child = std::make_unique<PlaceholderNode>("Page", 2, 1);

    // In real code: root->declarations.push_back(std::move(child));
    // unique_ptr is MOVE-ONLY — you can't copy it. This prevents double-free.
    // std::move() transfers ownership: after the move, 'child' is nullptr.

    // WHY is this good?
    // When 'root' goes out of scope at the end of this function, its destructor
    // runs, which in a real tree would delete all children recursively.
    // You never need to call delete manually. Memory leaks from forgetting
    // to delete become impossible.

    std::cout << "Root node: " << root->name << " @ " << root->line << ":" << root->col << "\n";
    std::cout << "Child node (before move): " << child->name << "\n";

    NodePtr moved = std::move(child); // transfer ownership
    std::cout << "After move, child is null: " << (child == nullptr ? "yes" : "no") << "\n";
    std::cout << "Moved node: " << static_cast<PlaceholderNode*>(moved.get())->name << "\n\n";
    // 'moved' destructs here — the PlaceholderNode is deleted automatically
}

// =============================================================================
// SECTION 5 — NodeKind-based dispatch
// =============================================================================
//
//  [PLACEHOLDER: Once node types are defined, this section shows a switch()
//   on node->kind as an alternative to chains of dynamic_cast<>:
//
//   void debugPrint(const Node* node) {
//       switch (node->kind) {
//           case NodeKind::Page:
//               auto* p = static_cast<const PageNode*>(node);
//               std::cout << "Page: " << p->label << "\n";
//               break;
//           case NodeKind::Field:
//               auto* f = static_cast<const FieldNode*>(node);
//               std::cout << "Field: " << f->name << ": " << f->typeName << "\n";
//               break;
//           // ...
//       }
//   }
//
//   static_cast (not dynamic_cast) is safe here BECAUSE we checked kind first.
//   It's faster (no RTTI lookup) and documents the intent: "I know the type".]

int main() {
    demonstrateOwnership();

    std::cout << "=== AST Design Principles ===\n\n";
    std::cout << "1. Nodes are dumb data — no business logic in the node class\n";
    std::cout << "2. unique_ptr encodes parent→child ownership\n";
    std::cout << "3. NodeKind enum allows cheap type checks\n";
    std::cout << "4. Virtual destructor ensures correct cleanup\n\n";

    std::cout << "[Full node hierarchy will be added from your Forml grammar.]\n";
    return 0;
}

// =============================================================================
// TRY THIS — [to be written after grammar is provided]
// =============================================================================
