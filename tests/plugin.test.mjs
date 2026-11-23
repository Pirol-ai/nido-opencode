// The parts of this repository a pull request can check without the agent on the machine.
//
// check.sh proves the real thing — install, and the skill arriving — but it needs the agent. These
// checks need nothing but Node, so they run on every pull request and catch what goes wrong in a
// manifest or a skill on its own: a path that points nowhere, a name that drifted between manifest
// and readme, a skill the agent cannot read.

import { test } from "node:test";
import assert from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...parts) => readFileSync(join(root, ...parts), "utf8");
const readJson = (...parts) => JSON.parse(read(...parts));

const SKILL = "skills/nido/SKILL.md";

test("the skill is one an agent can read", () => {
  const skill = read(SKILL);
  // The Agent Skills format: a name of lowercase words, and a description that says when to use
  // the skill, at most 1024 characters.
  assert.match(skill, /^---\nname: nido\n/, "the front matter does not name the skill nido");
  const description = skill.match(/^description: (.+)$/m)?.[1] ?? "";
  assert.ok(description.length >= 40, "the skill does not say when to use it");
  assert.ok(description.length <= 1024, "the description is longer than Agent Skills allow");
});

test("the skill keeps the safe defaults", () => {
  const skill = read(SKILL);
  // The person logs in themselves, a GPU is asked for first, and sandboxes are cleaned up.
  assert.match(skill, /Do not run the login for them/);
  assert.match(skill, /Ask\s+the person before you create one/);
  assert.match(skill, /nido rm <name>/);
  assert.match(skill, /--root` \| Only when/);
});

test("the location is called the EU, and only that", () => {
  // Where sandboxes run is "in the EU" in public text — never a city, a data centre or the
  // company that runs it.
  for (const file of [SKILL, "README.md"]) {
    assert.match(read(file), /in the EU/, `${file} does not say where sandboxes run`);
    assert.doesNotMatch(read(file), /data cent(er|re)|in (germany|france|poland)\b/i, `${file} names a place`);
  }
});

test("the package exports a server entry that is there", () => {
  const pkg = readJson("package.json");
  assert.strictEqual(pkg.type, "module");
  assert.ok(existsSync(join(root, pkg.exports["./server"])), "the server entry does not exist");
  for (const file of pkg.files) assert.ok(existsSync(join(root, file)), `${file} is listed but missing`);
});

test("the plugin adds the skill from SKILL.md, once", async () => {
  const plugin = (await import(join(root, "server.js"))).default;
  assert.strictEqual(plugin.id, "nido");

  const added = [];
  const editor = (existing) => ({ get: (id) => existing.find((s) => s.id === id), add: (s) => added.push(s) });
  let transform;
  await plugin.setup({ skill: { transform: async (callback) => (transform = callback) } });

  transform(editor([]));
  assert.strictEqual(added.length, 1);
  const [skill] = added;
  assert.strictEqual(skill.id, "nido");
  assert.ok(skill.description.length >= 40);
  assert.ok(skill.path.endsWith(join("skills", "nido", "SKILL.md")));
  assert.match(skill.content, /^# Pirol sandboxes with nido/, "the content still carries the front matter");

  // A nido skill the person keeps themselves wins.
  transform(editor([{ id: "nido" }]));
  assert.strictEqual(added.length, 1);
});

test("the readme installs this repository", () => {
  assert.match(read("README.md"), /opencode plugin add github:Pirol-ai\/nido-opencode/);
});
