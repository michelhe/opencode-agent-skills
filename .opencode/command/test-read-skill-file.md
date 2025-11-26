---
description: Test the read_skill_file tool
---

Test `read_skill_file` with different file types from `test-skill`:

1. Load `helper-docs.md` - a markdown documentation file
2. Load `example-config.json` - a JSON configuration file

Verify that:
1. Both files are injected with XML structure (`<skill-file>`, `<metadata>`, `<content>` tags)
2. The metadata includes the skill directory path
3. The tool returns a confirmation message for each file
4. Try loading a non-existent file and verify it lists available files in the error
