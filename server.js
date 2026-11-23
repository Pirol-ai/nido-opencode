// Registers the nido skill with OpenCode.
//
// The skill itself is the plain SKILL.md next to this file, the same one every other nido
// integration ships. OpenCode finds skills in fixed folders, not inside plugin packages, so this
// plugin hands it over: it reads the file and adds it to OpenCode's skill list. It does nothing
// else — no tools, no hooks, nothing that runs on its own.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "skills", "nido", "SKILL.md");

/** Splits a SKILL.md into its front matter fields and the instructions below it. */
export function parseSkill(text) {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file} has no front matter`);
  const fields = Object.fromEntries(
    match[1].split("\n").map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
  );
  return { name: fields.name, description: fields.description, content: match[2].trim() };
}

export default {
  id: "nido",
  async setup(context) {
    const skill = parseSkill(readFileSync(file, "utf8"));
    await context.skill.transform((skills) => {
      // A nido skill the person keeps in their own skills folder wins over this one.
      if (skills.get(skill.name)) return;
      skills.add({ id: skill.name, name: skill.name, description: skill.description, path: file, content: skill.content });
    });
  },
};
