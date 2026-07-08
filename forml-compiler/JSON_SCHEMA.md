# Forml AST JSON Schema

`JsonSerializer::serialize(FormNode&)` returns a `nlohmann::json` object. Every AST node object has a `"type"` string and, when the source location is available, a `"location"` object:

```json
{ "line": 1, "column": 1 }
```

Optional child blocks are omitted when absent. Empty repeated child collections are emitted as empty arrays.

## Node Shapes

### Form

```json
{
  "type": "Form",
  "name": "Form title",
  "groupDefinitions": [ "GroupDefinition" ],
  "varDeclarations": [ "VarDeclaration" ],
  "pages": [ "Page" ],
  "statements": [ "statement node" ],
  "action": "ActionBlock",
  "location": { "line": 1, "column": 1 }
}
```

`"action"` is omitted when no submit action block exists.

### Page

```json
{
  "type": "Page",
  "name": "Page title",
  "statements": [ "statement node" ],
  "trigger": "TriggerBlock",
  "location": { "line": 1, "column": 1 }
}
```

`"trigger"` is omitted when absent.

### GroupDefinition

```json
{
  "type": "GroupDefinition",
  "name": "group_name",
  "fields": [ "Field" ],
  "location": { "line": 1, "column": 1 }
}
```

### GroupUse

```json
{
  "type": "GroupUse",
  "groupName": "group_name",
  "location": { "line": 1, "column": 1 }
}
```

### VarDeclaration

```json
{
  "type": "VarDeclaration",
  "name": "var_name",
  "value": "Value",
  "location": { "line": 1, "column": 1 }
}
```

### Field

```json
{
  "type": "Field",
  "name": "field_name",
  "fieldType": "text|integer|float|email|date|boolean|url|select|radio|checkbox",
  "options": [ "Option label" ],
  "source": "SourceBlock",
  "ui": "UIBlock",
  "validation": "ValidationBlock",
  "compute": "ComputeBlock",
  "trigger": "TriggerBlock",
  "location": { "line": 1, "column": 1 }
}
```

`"source"`, `"ui"`, `"validation"`, `"compute"`, and `"trigger"` are omitted when absent.

### UIBlock

`UIBlockNode` is a plain AST support struct, not an `ASTNode`, but it is still serialized with a `"type"` field.

```json
{
  "type": "UIBlock",
  "label": "Label",
  "placeholder": "Placeholder",
  "helpText": "Help text",
  "default": "Value",
  "bind": "binding.name"
}
```

Each property is omitted when absent.

### ValidationBlock

`ValidationBlockNode` is a plain AST support struct, not an `ASTNode`, but it is still serialized with a `"type"` field.

```json
{
  "type": "ValidationBlock",
  "required": true,
  "min": 0.0,
  "max": 100.0,
  "minLength": 2.0,
  "maxLength": 100.0,
  "pattern": "regex"
}
```

Each property is omitted when absent. `"required"` is emitted only when true.

### Section

```json
{
  "type": "Section",
  "name": "Section title",
  "statements": [ "statement node" ],
  "location": { "line": 1, "column": 1 }
}
```

### Layout

```json
{
  "type": "Layout",
  "layoutKind": "row|column",
  "statements": [ "statement node" ],
  "location": { "line": 1, "column": 1 }
}
```

### RepeatGroup

```json
{
  "type": "RepeatGroup",
  "countRef": "identifier",
  "fields": [ "Field" ],
  "location": { "line": 1, "column": 1 }
}
```

### Conditional

```json
{
  "type": "Conditional",
  "condition": "condition node",
  "then": [ "statement node" ],
  "else": [ "statement node" ],
  "location": { "line": 1, "column": 1 }
}
```

`"else"` is always emitted as an array. It is empty when no else branch exists.

### SourceBlock

```json
{
  "type": "SourceBlock",
  "sourceKind": "url|var",
  "source": "https://example.com/api or var_name",
  "map": {
    "label": "label_key",
    "value": "value_key"
  },
  "location": { "line": 1, "column": 1 }
}
```

`"map"` is omitted when absent.

### ComputeBlock

```json
{
  "type": "ComputeBlock",
  "expression": "expression node",
  "location": { "line": 1, "column": 1 }
}
```

Expression trees preserve the parser's binary AST. For example, `base_rate * age + 10` becomes a `BinaryExpr("+")` whose left child is `BinaryExpr("*")`.

### Expression Nodes

```json
{
  "type": "BinaryExpr",
  "operator": "+|-|*|/",
  "left": "expression node",
  "right": "expression node",
  "location": { "line": 1, "column": 1 }
}
```

```json
{
  "type": "IdentifierExpr",
  "name": "identifier",
  "location": { "line": 1, "column": 1 }
}
```

```json
{
  "type": "NumberLiteral",
  "value": 10.0,
  "raw": "10",
  "location": { "line": 1, "column": 1 }
}
```

The current grammar does not support unary minus in `math_factor`, so negative numeric literals do not appear as a distinct expression node.

### Condition Nodes

```json
{
  "type": "BinaryCond",
  "operator": "&& or ||",
  "left": "condition node",
  "right": "condition node",
  "location": { "line": 1, "column": 1 }
}
```

```json
{
  "type": "SimpleCond",
  "field": "field_or_var_name",
  "comparator": "==|!=|<|>|<=|>=",
  "value": "Value",
  "location": { "line": 1, "column": 1 }
}
```

### Value

```json
{
  "type": "Value",
  "valueKind": "string|number|boolean|identifier",
  "text": "raw or normalized text",
  "numberValue": 10.0,
  "booleanValue": true,
  "location": { "line": 1, "column": 1 }
}
```

`"numberValue"` is emitted only for number values. `"booleanValue"` is emitted only for boolean values.

### TriggerBlock

```json
{
  "type": "TriggerBlock",
  "event": "load|change|blur|submit",
  "actions": [ "ActionStatement" ],
  "location": { "line": 1, "column": 1 }
}
```

### ActionStatement

```json
{
  "type": "ActionStatement",
  "action": "hide|show|clear|set|navigate|submit",
  "target": "field_or_url",
  "value": "Value",
  "location": { "line": 1, "column": 1 }
}
```

`"target"` is omitted for `submit()`. `"value"` is emitted only for `set(target, value)`.

### ActionBlock

```json
{
  "type": "ActionBlock",
  "endpoint": "https://example.com/submit",
  "method": "POST|PUT|PATCH",
  "location": { "line": 1, "column": 1 }
}
```

## Worked Example

Input fixture: `tests/fixtures/05_deep_nesting.forml`.

```json
{
  "action": {
    "endpoint": "https://api.example.com/apply",
    "location": {
      "column": 3,
      "line": 90
    },
    "method": "POST",
    "type": "ActionBlock"
  },
  "groupDefinitions": [
    {
      "fields": [
        {
          "fieldType": "text",
          "location": {
            "column": 5,
            "line": 13
          },
          "name": "phone",
          "options": [],
          "type": "Field",
          "ui": {
            "label": "Phone",
            "type": "UIBlock"
          }
        },
        {
          "fieldType": "text",
          "location": {
            "column": 5,
            "line": 14
          },
          "name": "fax",
          "options": [],
          "type": "Field",
          "ui": {
            "label": "Fax",
            "type": "UIBlock"
          }
        }
      ],
      "location": {
        "column": 3,
        "line": 12
      },
      "name": "contact_info",
      "type": "GroupDefinition"
    }
  ],
  "location": {
    "column": 1,
    "line": 8
  },
  "name": "Deep Nesting Test",
  "pages": [
    {
      "location": {
        "column": 3,
        "line": 17
      },
      "name": "Personal Details",
      "statements": [
        {
          "location": {
            "column": 5,
            "line": 19
          },
          "name": "Basic Info",
          "statements": [
            {
              "fieldType": "text",
              "location": {
                "column": 7,
                "line": 21
              },
              "name": "full_name",
              "options": [],
              "type": "Field",
              "ui": {
                "label": "Full Name",
                "placeholder": "Jane Doe",
                "type": "UIBlock"
              },
              "validation": {
                "maxLength": 100.0,
                "minLength": 2.0,
                "required": true,
                "type": "ValidationBlock"
              }
            },
            {
              "fieldType": "integer",
              "location": {
                "column": 7,
                "line": 30
              },
              "name": "age",
              "options": [],
              "type": "Field",
              "ui": {
                "label": "Age",
                "type": "UIBlock"
              },
              "validation": {
                "max": 120.0,
                "min": 0.0,
                "type": "ValidationBlock"
              }
            },
            {
              "fieldType": "email",
              "location": {
                "column": 7,
                "line": 37
              },
              "name": "email_addr",
              "options": [],
              "type": "Field",
              "ui": {
                "label": "Email Address",
                "type": "UIBlock"
              },
              "validation": {
                "required": true,
                "type": "ValidationBlock"
              }
            },
            {
              "compute": {
                "expression": {
                  "left": {
                    "left": {
                      "location": {
                        "column": 41,
                        "line": 44
                      },
                      "name": "base_rate",
                      "type": "IdentifierExpr"
                    },
                    "location": {
                      "column": 51,
                      "line": 44
                    },
                    "operator": "*",
                    "right": {
                      "location": {
                        "column": 53,
                        "line": 44
                      },
                      "name": "age",
                      "type": "IdentifierExpr"
                    },
                    "type": "BinaryExpr"
                  },
                  "location": {
                    "column": 57,
                    "line": 44
                  },
                  "operator": "+",
                  "right": {
                    "location": {
                      "column": 59,
                      "line": 44
                    },
                    "raw": "10",
                    "type": "NumberLiteral",
                    "value": 10.0
                  },
                  "type": "BinaryExpr"
                },
                "location": {
                  "column": 31,
                  "line": 44
                },
                "type": "ComputeBlock"
              },
              "fieldType": "float",
              "location": {
                "column": 7,
                "line": 44
              },
              "name": "total_cost",
              "options": [],
              "type": "Field"
            },
            {
              "condition": {
                "left": {
                  "comparator": ">=",
                  "field": "age",
                  "location": {
                    "column": 10,
                    "line": 47
                  },
                  "type": "SimpleCond",
                  "value": {
                    "location": {
                      "column": 17,
                      "line": 47
                    },
                    "numberValue": 18.0,
                    "text": "18",
                    "type": "Value",
                    "valueKind": "number"
                  }
                },
                "location": {
                  "column": 20,
                  "line": 47
                },
                "operator": "&&",
                "right": {
                  "comparator": "==",
                  "field": "email_addr",
                  "location": {
                    "column": 23,
                    "line": 47
                  },
                  "type": "SimpleCond",
                  "value": {
                    "location": {
                      "column": 37,
                      "line": 47
                    },
                    "text": "verified",
                    "type": "Value",
                    "valueKind": "string"
                  }
                },
                "type": "BinaryCond"
              },
              "else": [
                {
                  "fieldType": "text",
                  "location": {
                    "column": 9,
                    "line": 50
                  },
                  "name": "guardian_name",
                  "options": [],
                  "type": "Field",
                  "validation": {
                    "required": true,
                    "type": "ValidationBlock"
                  }
                }
              ],
              "location": {
                "column": 7,
                "line": 47
              },
              "then": [
                {
                  "fieldType": "text",
                  "location": {
                    "column": 9,
                    "line": 48
                  },
                  "name": "occupation",
                  "options": [],
                  "type": "Field",
                  "validation": {
                    "required": true,
                    "type": "ValidationBlock"
                  }
                }
              ],
              "type": "Conditional"
            }
          ],
          "type": "Section"
        },
        {
          "location": {
            "column": 5,
            "line": 55
          },
          "name": "Contact",
          "statements": [
            {
              "layoutKind": "row",
              "location": {
                "column": 7,
                "line": 56
              },
              "statements": [
                {
                  "groupName": "contact_info",
                  "location": {
                    "column": 9,
                    "line": 57
                  },
                  "type": "GroupUse"
                },
                {
                  "fieldType": "text",
                  "location": {
                    "column": 9,
                    "line": 58
                  },
                  "name": "city",
                  "options": [],
                  "type": "Field",
                  "ui": {
                    "label": "City",
                    "type": "UIBlock"
                  }
                }
              ],
              "type": "Layout"
            },
            {
              "layoutKind": "column",
              "location": {
                "column": 7,
                "line": 61
              },
              "statements": [
                {
                  "fieldType": "select",
                  "location": {
                    "column": 9,
                    "line": 62
                  },
                  "name": "country",
                  "options": [
                    "India",
                    "USA",
                    "UK"
                  ],
                  "type": "Field"
                }
              ],
              "type": "Layout"
            }
          ],
          "type": "Section"
        }
      ],
      "trigger": {
        "actions": [
          {
            "action": "show",
            "location": {
              "column": 7,
              "line": 72
            },
            "target": "occupation",
            "type": "ActionStatement"
          },
          {
            "action": "hide",
            "location": {
              "column": 7,
              "line": 73
            },
            "target": "guardian_name",
            "type": "ActionStatement"
          }
        ],
        "event": "load",
        "location": {
          "column": 5,
          "line": 71
        },
        "type": "TriggerBlock"
      },
      "type": "Page"
    },
    {
      "location": {
        "column": 3,
        "line": 78
      },
      "name": "Work Info",
      "statements": [
        {
          "countRef": "num_jobs",
          "fields": [
            {
              "fieldType": "text",
              "location": {
                "column": 7,
                "line": 81
              },
              "name": "job_title",
              "options": [],
              "type": "Field"
            },
            {
              "fieldType": "text",
              "location": {
                "column": 7,
                "line": 82
              },
              "name": "employer",
              "options": [],
              "type": "Field"
            },
            {
              "fieldType": "integer",
              "location": {
                "column": 7,
                "line": 83
              },
              "name": "start_year",
              "options": [],
              "type": "Field",
              "validation": {
                "max": 2100.0,
                "min": 1900.0,
                "type": "ValidationBlock"
              }
            }
          ],
          "location": {
            "column": 5,
            "line": 80
          },
          "type": "RepeatGroup"
        },
        {
          "fieldType": "integer",
          "location": {
            "column": 5,
            "line": 86
          },
          "name": "num_jobs",
          "options": [],
          "type": "Field",
          "validation": {
            "max": 20.0,
            "min": 0.0,
            "type": "ValidationBlock"
          }
        }
      ],
      "type": "Page"
    }
  ],
  "statements": [],
  "type": "Form",
  "varDeclarations": [
    {
      "location": {
        "column": 3,
        "line": 10
      },
      "name": "base_rate",
      "type": "VarDeclaration",
      "value": {
        "location": {
          "column": 19,
          "line": 10
        },
        "numberValue": 0.15,
        "text": "0.15",
        "type": "Value",
        "valueKind": "number"
      }
    }
  ]
}
```
