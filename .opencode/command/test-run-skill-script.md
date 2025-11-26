---
description: Test the run_skill_script tool
---

Test `run_skill_script` with scripts from `test-skill`:

1. Run the `greet` script with no arguments
2. Run the `echo-args` script with arguments: `foo`, `bar`, `--baz`

Verify that:
1. The `greet` script outputs "Hello from test-skill!" and shows the CWD is the skill directory
2. The `echo-args` script correctly echoes back all arguments passed
3. Try running a non-existent script and verify it lists available scripts in the error
