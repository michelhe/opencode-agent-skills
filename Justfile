set dotenv-load := true
set unstable := true

[private]
default:
    @just --list --list-submodules

[private]
fmt:
    @just --fmt

# Build the plugin
build:
    bun build src/plugin.ts --target=bun --outfile=dist/skills-plugin.ts --external=@opencode-ai/plugin

# Install dev plugin globally
install: build
    mkdir -p ~/.config/opencode/plugin
    ln -sf "$(pwd)/dist/skills-plugin.ts" ~/.config/opencode/plugin/skills.ts

# Uninstall plugin
uninstall:
    rm -f ~/.config/opencode/plugin/skills.ts

# Check if plugin is installed
status:
    @ls -la ~/.config/opencode/plugin/skills.ts 2>/dev/null || echo "Not installed"

# Run tests
test:
    bun test
