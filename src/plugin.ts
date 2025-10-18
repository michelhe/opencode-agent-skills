import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import * as fs from "fs/promises";
import * as path from "path";
import { homedir } from "os";

interface SkillMetadata {
  name: string;
  description: string;
  id: string;
  path: string;
}

interface ParsedSkill extends SkillMetadata {
  content: string;
}

// Define skill frontmatter schema
const skillFrontmatterSchema = tool.schema.object({
  name: tool.schema.string().max(64),
  description: tool.schema.string().max(1024)
});

async function parseSkillFile(skillPath: string): Promise<ParsedSkill | null> {
  const content = await fs.readFile(skillPath, 'utf-8').catch(() => null);
  if (!content) return null;

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const frontmatterText = frontmatterMatch[1];
  const skillContent = frontmatterMatch[2];

  // Parse YAML into object (simple parser for basic key: value)
  const frontmatterObj: Record<string, string> = {};
  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      frontmatterObj[key] = value.trim().replace(/^["']|["']$/g, '');
    }
  }

  // Validate with Zod
  const parsed = skillFrontmatterSchema.safeParse(frontmatterObj);
  if (!parsed.success) return null;

  const skillDir = path.dirname(skillPath);
  const skillId = path.basename(skillDir);

  return {
    name: parsed.data.name,
    description: parsed.data.description,
    id: skillId,
    path: skillDir,
    content: skillContent
  };
}

async function findSkillDirectories(baseDir: string): Promise<string[]> {
  const skillPaths: string[] = [];

  // Check if directory exists first
  try {
    await fs.access(baseDir);
  } catch {
    return skillPaths; // Directory doesn't exist, return empty array
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(baseDir, entry.name, 'SKILL.md');
      // Check if SKILL.md exists using fs.stat instead of fs.access
      await fs.stat(skillPath)
        .then(() => skillPaths.push(skillPath))
        .catch(() => { }); // File doesn't exist, skip it
    }
  }

  return skillPaths;
}

async function getAllSkills(directory: string, worktree: string): Promise<SkillMetadata[]> {
  const skillDirs = [
    path.join(directory, '.opencode', 'skills'),
    path.join(directory, '.claude', 'skills'),
    path.join(homedir(), '.config', 'opencode', 'skills'),
    path.join(homedir(), '.claude', 'skills')
  ];

  const allSkillPaths: string[] = [];

  for (const dir of skillDirs) {
    const paths = await findSkillDirectories(dir);
    allSkillPaths.push(...paths);
  }

  const skills: SkillMetadata[] = [];

  for (const skillPath of allSkillPaths) {
    const skill = await parseSkillFile(skillPath);
    if (skill) {
      skills.push({
        name: skill.name,
        description: skill.description,
        id: skill.id,
        path: skill.path
      });
    }
  }

  return skills;
}

export const SkillsPlugin: Plugin = async ({ client, $, worktree, directory }) => {
  // Cache for loaded skills content (not metadata)
  const loadedSkills = new Map<string, ParsedSkill>();

  return {
    // Inject skill metadata into system prompt
    "session.prompt.system": async () => {
      const availableSkills = await getAllSkills(directory, worktree);
      
      if (availableSkills.length === 0) {
        return "";
      }

      const skillsList = availableSkills
        .map(skill => `- ${skill.name} (${skill.id}): ${skill.description}`)
        .join('\n');

      return `
## Available Skills

The following skills are available for use. Use the find_skills tool to discover relevant skills for your task, then use activate_skill to load a skill's instructions when needed.

${skillsList}

Remember to use the find_skills tool at the start of tasks to discover relevant skills that could help.`;
    },

    tool: {
      find_skills: tool({
        description: "Search and discover available skills. Use this at the start of any task to find relevant skills that could help. Returns a list of skills with their metadata.",
        args: {
          query: tool.schema.string().optional()
            .describe("Optional search query to filter skills by name or description (case-insensitive)")
        },
        async execute(args) {
          const availableSkills = await getAllSkills(directory, worktree);
          let filteredSkills = availableSkills;

          if (args.query) {
            const query = args.query.toLowerCase();
            filteredSkills = availableSkills.filter(skill =>
              skill.name.toLowerCase().includes(query) ||
              skill.description.toLowerCase().includes(query) ||
              skill.id.toLowerCase().includes(query)
            );
          }

          if (filteredSkills.length === 0) {
            return "No skills found matching your query.";
          }

          const result = filteredSkills
            .map(skill => `${skill.name} (${skill.id}): ${skill.description}`)
            .join('\n');

          return result;
        },
      }),

      activate_skill: tool({
        description: "Load a skill by injecting its SKILL.md content into the conversation. This brings the skill's instructions into context.",
        args: {
          skill_id: tool.schema.string()
            .describe("The ID of the skill to activate (from find_skills)")
        },
        async execute(args) {
          // Check if already loaded
          if (loadedSkills.has(args.skill_id)) {
            const skill = loadedSkills.get(args.skill_id)!;
            return skill.content;
          }

          // Find skill in available skills
          const availableSkills = await getAllSkills(directory, worktree);
          const skillMeta = availableSkills.find(s => s.id === args.skill_id);

          if (!skillMeta) {
            return `Skill "${args.skill_id}" not found`;
          }

          // Load the skill content
          const skillPath = path.join(skillMeta.path, 'SKILL.md');
          const skill = await parseSkillFile(skillPath);

          if (!skill) {
            return `Failed to load skill "${args.skill_id}"`;
          }

          // Cache the loaded skill
          loadedSkills.set(args.skill_id, skill);

          return skill.content;
        },
      }),

      run_skill_script: tool({
        description: "Execute a script within a skill's directory. Scripts can be any executable file in the skill folder.",
        args: {
          skill_id: tool.schema.string()
            .describe("The ID of the skill containing the script"),
          script: tool.schema.string()
            .describe("The script filename or path relative to the skill directory"),
          args: tool.schema.array(tool.schema.string()).optional()
            .describe("Optional arguments to pass to the script")
        },
        async execute(args) {
          const availableSkills = await getAllSkills(directory, worktree);
          const skillMeta = availableSkills.find(s => s.id === args.skill_id);

          if (!skillMeta) {
            return `Skill "${args.skill_id}" not found`;
          }

          const scriptPath = path.join(skillMeta.path, args.script);

          try {
            // Check if script exists
            await fs.access(scriptPath);

            // Use Bun's $ shell to execute the script but with proper cwd
            const scriptArgs = args.args || [];

            // Set cwd and execute script
            $.cwd(skillMeta.path);
            const result = await $`${scriptPath} ${scriptArgs}`.text();

            return result;
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              return `Script "${args.script}" not found in skill "${args.skill_id}"`;
            }

            // Check if it's a Bun shell error
            if (error.exitCode !== undefined) {
              const stderr = error.stderr?.toString() || '';
              const stdout = error.stdout?.toString() || '';
              return `Script failed (exit code ${error.exitCode}): ${stderr || stdout || error.message}`;
            }

            return `Script failed: ${error.message}`;
          }
        },
      }),

      list_skill_files: tool({
        description: "List all files in a skill's directory, useful for exploring skill resources.",
        args: {
          skill_id: tool.schema.string()
            .describe("The ID of the skill to explore")
        },
        async execute(args) {
          const availableSkills = await getAllSkills(directory, worktree);
          const skillMeta = availableSkills.find(s => s.id === args.skill_id);

          if (!skillMeta) {
            return `Skill "${args.skill_id}" not found`;
          }

          async function listFiles(dir: string, prefix = ''): Promise<string[]> {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files: string[] = [];

            for (const entry of entries) {
              const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
              if (entry.isDirectory()) {
                const subFiles = await listFiles(path.join(dir, entry.name), relativePath);
                files.push(...subFiles);
              } else {
                files.push(relativePath);
              }
            }

            return files;
          }

          try {
            const files = await listFiles(skillMeta.path);
            return files.sort().join('\n');
          } catch (error: any) {
            return `Failed to list files: ${error.message}`;
          }
        },
      }),

      read_skill_file: tool({
        description: "Read a specific file from a skill's directory.",
        args: {
          skill_id: tool.schema.string()
            .describe("The ID of the skill containing the file"),
          file_path: tool.schema.string()
            .describe("Path to the file relative to the skill directory")
        },
        async execute(args) {
          const availableSkills = await getAllSkills(directory, worktree);
          const skillMeta = availableSkills.find(s => s.id === args.skill_id);

          if (!skillMeta) {
            return `Skill "${args.skill_id}" not found`;
          }

          const filePath = path.join(skillMeta.path, args.file_path);

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
          } catch (error: any) {
            if (error.code === 'ENOENT') {
              return `File "${args.file_path}" not found in skill "${args.skill_id}"`;
            }
            return `Failed to read file: ${error.message}`;
          }
        },
      })
    }
  };
};
