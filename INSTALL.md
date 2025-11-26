# Installing opencode-agent-skills

```bash
# Clone
git clone https://github.com/joshuadavidthomas/opencode-agent-skills ~/.config/opencode/opencode-agent-skills

# Symlink plugin
mkdir -p ~/.config/opencode/plugin
ln -sf ~/.config/opencode/opencode-agent-skills/src/plugin.ts ~/.config/opencode/plugin/skills.ts
```

Restart OpenCode.

## Updating

```bash
cd ~/.config/opencode/opencode-agent-skills && git pull
```

## Uninstalling

```bash
rm ~/.config/opencode/plugin/skills.ts
rm -rf ~/.config/opencode/opencode-agent-skills
```
