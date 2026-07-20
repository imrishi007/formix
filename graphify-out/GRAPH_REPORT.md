# Graph Report - c:\Users\Rishi\Desktop\Foxmix\formix  (2026-07-19)

## Corpus Check
- 155 files · ~154,877 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1821 nodes · 3566 edges · 146 communities (82 shown, 64 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 233 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Frontend UI Elements
- JSON Serialization Library
- Forml AST Node Representation
- UI Component Breadcrumb, Card
- UI Component Form, Sheet
- WASM Compiler Bridge
- WASM Compiler Bridge
- JSON Parser Implementation
- JSON SAX Parser
- Forml Parser Component
- Forml AST Node Representation
- WASM Compiler Bridge
- Forml AST Node Representation
- Forml Lexer Component
- Forml Lexer Component
- Forml Parser Component
- Components Editor Demo Ide
- FastAPI Backend API
- Ref Dom
- FastAPI Backend API
- Forml AST Node Representation
- JSON Serialization Library
- Package
- FastAPI Backend API
- UI Component Alert, Button
- JSON SAX Parser
- JSON SAX Parser
- UI Component Accordion, Badge
- Binarycondnode
- UI Component Command, Dialog
- JSON SAX Parser
- Include Forml Diagnostics
- UI Component Button, Field
- Forml Parser Component
- Components
- Forml AST Node Representation
- JSON Serialization Library
- Forml AST Node Representation
- Semantic Analysis and Validation
- Forml AST Node Representation
- FastAPI Backend API
- Components Editor Demo Ide
- UI Component Dropdown
- Forml AST Node Representation
- Forml AST Node Representation
- Forml AST Node Representation
- Frontend UI Elements
- Forml AST Node Representation
- Forml AST Node Representation
- Forml AST Node Representation
- Forml AST Node Representation
- Forml AST Node Representation
- UI Component Form, Label
- UI Component Input, Textarea
- UI Component Item
- JSON Serialization Library
- Forml AST Node Representation
- Forml Parser Component
- Forml Parser Component
- Semantic Analysis and Validation
- App Auth Signin Page
- UI Component Navigation
- Semantic Analysis and Validation
- Lib Forml File System
- JSON SAX Parser
- UI Component Empty
- Forml AST Node Representation
- Forml Lexer Component
- Forml Parser Component
- WASM Compiler Bridge
- App Layout
- Include Forml Token
- UI Component Alert
- Semantic Analysis and Validation
- FastAPI Backend API
- Semantic Analysis and Validation
- Src Json Serializer Cpp
- App Compiler Page
- App Editor Demo Page
- Class Variance Authority
- Cmdk
- Date Fns
- Embla Carousel React
- Expo
- Expo File System
- Src Json Serializer Actionkindtostring
- Src Json Serializer Cpp
- Src Json Serializer Cpp
- Src Json Serializer Cpp
- Src Json Serializer Cpp
- Src Json Serializer Cpp
- Framer Motion
- Geist
- Hookform Resolvers
- Input Otp
- Lucide React
- Monaco Editor
- Monaco Editor React
- Next
- Next Config
- Next Themes
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Forml AST Node Representation
- Frontend UI Elements
- Frontend UI Elements
- Frontend UI Elements
- Package Dependencies React Day
- Package Dependencies React Dom
- Package Dependencies React Hook
- Package Dependencies React Native
- Package Dependencies React Resizable
- Package Dependencies React Three
- Package Dependencies Recharts
- Package Dependencies Sonner
- Package Dependencies Tailwind Merge
- Package Dependencies Tailwindcss Animate
- Package Dependencies Three
- Package Dependencies Vaul
- Package Dependencies Zod
- Postcss Config

## God Nodes (most connected - your core abstractions)
1. `cn()` - 209 edges
2. `string()` - 102 edges
3. `Parser` - 43 edges
4. `basic_json()` - 41 edges
5. `operator<()` - 39 edges
6. `JsonSerializer::visit()` - 38 edges
7. `advance` - 32 edges
8. `SemanticAnalyzer` - 31 edges
9. `handle_value()` - 30 edges
10. `push_back()` - 28 edges

## Surprising Connections (you probably didn't know these)
- `AccordionItem()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AccordionTrigger()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AccordionContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/accordion.tsx → lib/utils.ts
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  components/ui/alert-dialog.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (146 total, 64 thin omitted)

### Community 0 - "Frontend UI Elements"
Cohesion: 0.06
Nodes (43): metadata, metadata, metadata, metadata, fieldTypes, metadata, metadata, metadata (+35 more)

### Community 1 - "JSON Serialization Library"
Cohesion: 0.11
Nodes (56): byte_container_with_subtype, const_iterator, const_reference, difference_type, else, at(), begin(), cbegin() (+48 more)

### Community 2 - "Forml AST Node Representation"
Cohesion: 0.05
Nodes (49): ActionBlockNode, ActionStatementNode, ASTVisitor, visit, BinaryCondNode, BinaryExprNode, ComputeBlockNode, ConditionalNode (+41 more)

### Community 3 - "UI Component Breadcrumb, Card"
Cohesion: 0.07
Nodes (39): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), Card(), CardAction() (+31 more)

### Community 4 - "UI Component Form, Sheet"
Cohesion: 0.05
Nodes (43): FormItem(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle() (+35 more)

### Community 5 - "WASM Compiler Bridge"
Cohesion: 0.06
Nodes (28): abort(), craftInvokerFunction(), createJsInvoker(), createWasm(), EmscriptenEH, EmscriptenSjLj, ExceptionInfo, ExitStatus (+20 more)

### Community 6 - "WASM Compiler Bridge"
Cohesion: 0.06
Nodes (28): abort(), craftInvokerFunction(), createJsInvoker(), createWasm(), EmscriptenEH, EmscriptenSjLj, ExceptionInfo, ExitStatus (+20 more)

### Community 7 - "JSON Parser Implementation"
Cohesion: 0.06
Nodes (43): Allocator, const_reverse_iterator, Exception, adl_serializer, boolean(), clear(), crbegin(), crend() (+35 more)

### Community 8 - "JSON SAX Parser"
Cohesion: 0.11
Nodes (34): back(), empty(), end_array(), end_object(), get_number_float(), get_token_string(), handle_value(), is_discarded() (+26 more)

### Community 9 - "Forml Parser Component"
Cohesion: 0.06
Nodes (26): AnimatedWave(), AST_LINES, ASTVisualizer(), delay(), DSL_LINES, FILE_TREE, CtaSection(), AstField (+18 more)

### Community 10 - "Forml AST Node Representation"
Cohesion: 0.06
Nodes (37): ASTVisitor, FieldNode, accept, column, computeBlock, fieldType, line, name (+29 more)

### Community 11 - "WASM Compiler Bridge"
Cohesion: 0.08
Nodes (31): DiagnosticEngine, clear, count, diagnostics_, error, hasErrors, hasWarnings, printAll (+23 more)

### Community 12 - "Forml AST Node Representation"
Cohesion: 0.08
Nodes (30): ActionStatementNode, accept, actionKind, column, line, setValue, target, ActionKind (+22 more)

### Community 13 - "Forml Lexer Component"
Cohesion: 0.08
Nodes (29): size_t, TokenType, Lexer, column_, current_, isAtEnd, keywords_, line_ (+21 more)

### Community 14 - "Forml Lexer Component"
Cohesion: 0.11
Nodes (33): stripQuotes(), advance, peek, peekNext, isSoftKeyword, parseActionStatement, parseField, synchronize (+25 more)

### Community 15 - "Forml Parser Component"
Cohesion: 0.09
Nodes (33): size_t, vector, Parser, current_, dummyToken_, error, isAtEnd, isHardKeyword (+25 more)

### Community 16 - "Components Editor Demo Ide"
Cohesion: 0.07
Nodes (15): CompilePhase, CursorState, defineFormixMono(), DIAG_TABS, DiagTab, EditorPanel(), MONACO_OPTIONS, MonacoEditor (+7 more)

### Community 17 - "FastAPI Backend API"
Cohesion: 0.12
Nodes (26): create_access_token(), decode_access_token(), get_current_user(), _get_secret(), hash_password(), Session, backend/auth.py Authentication utilities for Formix:   - Password hashing / veri, Hash a plaintext password using bcrypt. Returns a utf-8 string. (+18 more)

### Community 18 - "Ref Dom"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 19 - "FastAPI Backend API"
Cohesion: 0.12
Nodes (26): Any, Form, A single respondent's answer payload for a published form.      - respondent_ses, A form definition created by an author.      - project_id    : which project thi, Submission, _fire_webhook(), get_form(), _get_unconditional_required_fields() (+18 more)

### Community 20 - "Forml AST Node Representation"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 21 - "JSON Serialization Library"
Cohesion: 0.12
Nodes (19): main(), readFile(), vector, RepeatGroupNode, accept, column, countRef, fields (+11 more)

### Community 22 - "Package"
Cohesion: 0.08
Nodes (25): devDependencies, postcss, tailwindcss, @tailwindcss/postcss, tw-animate-css, @types/node, @types/react, @types/react-dom (+17 more)

### Community 23 - "FastAPI Backend API"
Cohesion: 0.17
Nodes (23): Project, An author account.  Respondents fill forms anonymously and never have an account, A named container that groups related forms together (like an Overleaf project)., User, create_form_in_project(), create_project(), _get_form_or_403(), get_project() (+15 more)

### Community 24 - "UI Component Alert, Button"
Cohesion: 0.11
Nodes (17): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+9 more)

### Community 25 - "JSON SAX Parser"
Cohesion: 0.13
Nodes (9): get_number_unsigned(), json_sax_acceptor, namespace(), number_integer(), number_unsigned(), operator "" _json_pointer(), remove_sign(), number_integer_t (+1 more)

### Community 26 - "JSON SAX Parser"
Cohesion: 0.25
Nodes (22): char_int_type, accept(), add(), array(), from_bjdata(), from_bson(), from_cbor(), from_msgpack() (+14 more)

### Community 27 - "UI Component Accordion, Badge"
Cohesion: 0.10
Nodes (10): AccordionContent(), AccordionItem(), AccordionTrigger(), Badge(), badgeVariants, Checkbox(), PopoverContent(), Progress() (+2 more)

### Community 28 - "Binarycondnode"
Cohesion: 0.10
Nodes (21): BinaryCondNode, BinaryExprNode, ActionBlockNode, ActionStatementNode, ComputeBlockNode, ConditionalNode, FormNode, GroupDefinitionNode (+13 more)

### Community 29 - "UI Component Command, Dialog"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 30 - "JSON SAX Parser"
Cohesion: 0.15
Nodes (19): array_t, binary_t, boolean_t, binary(), get_impl_ptr(), get_ptr(), is_array(), is_binary() (+11 more)

### Community 31 - "Include Forml Diagnostics"
Cohesion: 0.11
Nodes (15): Diagnostic, column, line, message, severity, report, Severity, Severity (+7 more)

### Community 32 - "UI Component Button, Field"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 33 - "Forml Parser Component"
Cohesion: 0.15
Nodes (18): parseExpression, parseMathFactor, parseMathTerm, ComputeBlockNode, ExprPtr, Token, TokenType, vector (+10 more)

### Community 34 - "Components"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 35 - "Forml AST Node Representation"
Cohesion: 0.11
Nodes (16): FormNode, accept, actionBlock, column, groupDefinitions, line, name, pages (+8 more)

### Community 36 - "JSON Serialization Library"
Cohesion: 0.20
Nodes (17): CompatibleType, basic_json(), decode(), flatten(), vector, patch(), to_bjdata(), to_bson() (+9 more)

### Community 37 - "Forml AST Node Representation"
Cohesion: 0.13
Nodes (15): BinaryCondNode, accept, column, left, line, op, right, ConditionalNode (+7 more)

### Community 38 - "Semantic Analysis and Validation"
Cohesion: 0.16
Nodes (17): FormNode, SemanticAnalyzer, allFields_, error, groupNames_, pageNames_, varNames_, visitConditional (+9 more)

### Community 39 - "Forml AST Node Representation"
Cohesion: 0.16
Nodes (12): Base, backend/database.py SQLAlchemy engine and session factory for the Formix backend, Shared declarative base for all ORM models., health(), lifespan(), backend/main.py FastAPI application entry point for the Formix backend.  Run wit, Quick liveness check., _now() (+4 more)

### Community 40 - "FastAPI Backend API"
Cohesion: 0.19
Nodes (15): publish_form(), Mark a form as published and store the final compiled schema.      The frontend, Config, FormCreateResponse, FormSummary, FormUpdate, ProjectDetail, ProjectResponse (+7 more)

### Community 41 - "Components Editor Demo Ide"
Cohesion: 0.17
Nodes (14): DemoIdeShell(), API_BASE, ApiError, createForm(), FormCreate, FormCreateResponse, FormUpdate, getResponses() (+6 more)

### Community 42 - "UI Component Dropdown"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 43 - "Forml AST Node Representation"
Cohesion: 0.13
Nodes (14): EventType, PageNode, accept, column, line, name, statements, triggerBlock (+6 more)

### Community 44 - "Forml AST Node Representation"
Cohesion: 0.13
Nodes (14): LayoutKind, NodeList, LayoutNode, accept, column, layoutKind, line, statements (+6 more)

### Community 45 - "Forml AST Node Representation"
Cohesion: 0.19
Nodes (10): FormRenderer(), SubmitState, Props, ASTNode, DynamicField(), evalCondition(), RenderStatements(), getForm() (+2 more)

### Community 46 - "Frontend UI Elements"
Cohesion: 0.13
Nodes (15): autoprefixer, clsx, expo-asset, expo-gl, dependencies, autoprefixer, clsx, expo-asset (+7 more)

### Community 47 - "Forml AST Node Representation"
Cohesion: 0.15
Nodes (13): BinaryExprNode, accept, column, left, line, op, right, ComputeBlockNode (+5 more)

### Community 48 - "Forml AST Node Representation"
Cohesion: 0.13
Nodes (12): ExprNode, IdentifierExprNode, accept, column, line, name, NumberLiteralNode, accept (+4 more)

### Community 49 - "Forml AST Node Representation"
Cohesion: 0.15
Nodes (12): ASTVisitor, json, JsonSerializer, current_, serializeCond, serializeExpr, serializeFields, serializeStatementList (+4 more)

### Community 50 - "Forml AST Node Representation"
Cohesion: 0.27
Nodes (13): serializeNode, ASTNode, json, NodeList, JsonSerializer::serialize(), JsonSerializer::serializeCond(), JsonSerializer::serializeExpr(), JsonSerializer::serializeNode() (+5 more)

### Community 51 - "Forml AST Node Representation"
Cohesion: 0.20
Nodes (13): visitForm, collectFieldsFromNode(), ASTNode, FieldType, GroupUseNode, unordered_map, isNumericField(), isTextLikeField() (+5 more)

### Community 52 - "UI Component Form, Label"
Cohesion: 0.22
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItemContext, FormItemContextValue, FormLabel(), FormMessage() (+2 more)

### Community 53 - "UI Component Input, Textarea"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 54 - "UI Component Item"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 55 - "JSON Serialization Library"
Cohesion: 0.18
Nodes (12): false_type, data, m_type, m_value, dump_float(), dump_integer(), is_negative_number(), type() (+4 more)

### Community 56 - "Forml AST Node Representation"
Cohesion: 0.19
Nodes (9): ASTNode, accept, CondExprNode, GroupUseNode, accept, column, groupName, line (+1 more)

### Community 57 - "Forml Parser Component"
Cohesion: 0.19
Nodes (13): check, parseCondition, parseLogicFactor, parseLogicTerm, parseSimpleCondition, ConditionalNode, CondPtr, LayoutNode (+5 more)

### Community 58 - "Forml Parser Component"
Cohesion: 0.18
Nodes (13): parseForm, parseValue, ActionStatementNode, FormNode, GroupUseNode, SimpleCondNode, unique_ptr, VarDeclarationNode (+5 more)

### Community 59 - "Semantic Analysis and Validation"
Cohesion: 0.18
Nodes (13): visitStatement, visitStatementList, ConditionalNode, LayoutNode, NodeList, PageNode, SectionNode, unordered_set (+5 more)

### Community 60 - "App Auth Signin Page"
Cohesion: 0.22
Nodes (4): AuthLayout(), AuthLayoutProps, BlueprintGrid, EditorPanel

### Community 61 - "UI Component Navigation"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 62 - "Semantic Analysis and Validation"
Cohesion: 0.20
Nodes (10): checkConditionRefs, checkExprRefs, checkIdentifierRef, checkValidationTypeCompat, FieldNode, RepeatGroupNode, SemanticAnalyzer::checkConditionRefs(), SemanticAnalyzer::checkExprRefs() (+2 more)

### Community 63 - "Lib Forml File System"
Cohesion: 0.24
Nodes (9): createFileSystemStore(), FileSystemListener, FileSystemStore, FileType, getFileSystemStore(), inferFileType(), newFormlTemplate(), SAMPLE_FILES (+1 more)

### Community 64 - "JSON SAX Parser"
Cohesion: 0.25
Nodes (9): BasicJsonType, from_json(), get_impl(), json_sax_dom_parser(), noexcept(), to_json(), priority_tag, TargetType (+1 more)

### Community 65 - "UI Component Empty"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 66 - "Forml AST Node Representation"
Cohesion: 0.29
Nodes (7): ActionBlockNode, accept, column, endpoint, line, method, HttpMethod

### Community 67 - "Forml Lexer Component"
Cohesion: 0.29
Nodes (7): unordered_map, FieldType, unordered_map, unordered_set, Scope, fields, vars

### Community 68 - "Forml Parser Component"
Cohesion: 0.54
Nodes (7): ASTNode, ValueNode, indent(), printCond(), printExpr(), printNode(), printValue()

### Community 69 - "WASM Compiler Bridge"
Cohesion: 0.32
Nodes (7): FormlCompileResult, FormlDiagnostic, LoadState, loadWasm(), notifySubscribers(), subscribers, useFormlCompiler()

### Community 70 - "App Layout"
Cohesion: 0.29
Nodes (5): instrumentSans, instrumentSerif, inter, jetbrainsMono, metadata

### Community 71 - "Include Forml Token"
Cohesion: 0.29
Nodes (6): TokenType, Token, column, lexeme, line, type

### Community 72 - "UI Component Alert"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 73 - "Semantic Analysis and Validation"
Cohesion: 0.40
Nodes (5): checkRepeatCountRef, visitField, GroupDefinitionNode, SemanticAnalyzer::visitGroupDefinition(), SemanticAnalyzer::visitRepeatGroup()

### Community 76 - "Semantic Analysis and Validation"
Cohesion: 0.50
Nodes (4): checkVarLiteralOnly, VarDeclarationNode, SemanticAnalyzer::checkVarLiteralOnly(), SemanticAnalyzer::visitVarDeclaration()

### Community 77 - "Src Json Serializer Cpp"
Cohesion: 0.50
Nodes (4): FieldNode, unique_ptr, vector, JsonSerializer::serializeFields()

## Knowledge Gaps
- **430 isolated node(s):** `metadata`, `metadata`, `metadata`, `metadata`, `metadata` (+425 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `string()` connect `JSON Serialization Library` to `Forml AST Node Representation`, `JSON Parser Implementation`, `JSON SAX Parser`, `Forml AST Node Representation`, `WASM Compiler Bridge`, `Forml AST Node Representation`, `Forml Lexer Component`, `Forml Lexer Component`, `JSON SAX Parser`, `Include Forml Diagnostics`, `Forml Parser Component`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Semantic Analysis and Validation`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Forml AST Node Representation`, `Semantic Analysis and Validation`, `Semantic Analysis and Validation`, `Forml AST Node Representation`, `Forml Lexer Component`, `Forml Parser Component`, `Include Forml Token`, `Semantic Analysis and Validation`, `Semantic Analysis and Validation`, `Src Json Serializer Actionkindtostring`, `Src Json Serializer Cpp`, `Src Json Serializer Cpp`, `Src Json Serializer Cpp`, `Src Json Serializer Cpp`, `Src Json Serializer Cpp`?**
  _High betweenness centrality (0.295) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Frontend UI Elements` to `Frontend UI Elements`, `Frontend UI Elements`, `Package Dependencies React Day`, `Package Dependencies React Dom`, `UI Component Form, Sheet`, `Package Dependencies React Hook`, `Package Dependencies React Native`, `Package Dependencies React Resizable`, `Package Dependencies React Three`, `Package Dependencies Recharts`, `Package Dependencies Sonner`, `Package Dependencies Tailwind Merge`, `Package Dependencies Tailwindcss Animate`, `Package Dependencies Three`, `Package Dependencies Vaul`, `Package Dependencies Zod`, `Package`, `Class Variance Authority`, `Cmdk`, `Date Fns`, `Embla Carousel React`, `Expo`, `Expo File System`, `Framer Motion`, `Geist`, `Hookform Resolvers`, `Input Otp`, `Lucide React`, `Monaco Editor`, `Monaco Editor React`, `Next`, `Next Themes`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Frontend UI Elements`, `Forml AST Node Representation`, `Frontend UI Elements`?**
  _High betweenness centrality (0.291) - this node is a cross-community bridge._
- **Why does `erase_internal()` connect `JSON Serialization Library` to `Package`, `JSON Parser Implementation`?**
  _High betweenness centrality (0.273) - this node is a cross-community bridge._
- **What connects `metadata`, `metadata`, `metadata` to the rest of the system?**
  _430 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Elements` be split into smaller, more focused modules?**
  _Cohesion score 0.05586741512964448 - nodes in this community are weakly interconnected._
- **Should `JSON Serialization Library` be split into smaller, more focused modules?**
  _Cohesion score 0.10779220779220779 - nodes in this community are weakly interconnected._
- **Should `Forml AST Node Representation` be split into smaller, more focused modules?**
  _Cohesion score 0.053544494720965306 - nodes in this community are weakly interconnected._