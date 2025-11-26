# Helper Documentation

This file tests the `read_skill_file` tool with markdown content.

## Purpose

When you load this file using `read_skill_file`, it should:
1. Be injected into context via `noReply` + `synthetic: true`
2. Be wrapped in `<skill-file>` XML tags
3. Include metadata about the skill directory

## Sample Content

Here's some sample content to verify the file loaded correctly:

- Item 1: Testing list rendering
- Item 2: More list items
- Item 3: Even more items

### Code Example

```python
def hello():
    print("Hello from helper-docs.md!")
```

## Verification

If you can see this content, `read_skill_file` is working correctly!
