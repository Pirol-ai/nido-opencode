#!/bin/sh
# Does this package actually give OpenCode the nido skill?
#
# Everything happens in a throwaway HOME, so the person's own OpenCode is not touched. The plugin is
# loaded from this working copy through the config (`opencode plugin add` only takes npm and Git
# specs), and OpenCode's own server is asked which skills it has.
#
# Run it from anywhere:  sh check.sh

set -eu

repo=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)

HOME="$work/home"
XDG_CONFIG_HOME="$HOME/.config"
XDG_DATA_HOME="$HOME/.local/share"
XDG_STATE_HOME="$HOME/.local/state"
XDG_CACHE_HOME="$HOME/.cache"
export HOME XDG_CONFIG_HOME XDG_DATA_HOME XDG_STATE_HOME XDG_CACHE_HOME
mkdir -p "$XDG_CONFIG_HOME/opencode"

# The first request starts a background server for this HOME; it must not outlive the check.
trap 'opencode service stop >/dev/null 2>&1 || true; rm -rf "$work"' EXIT

fail() {
  echo "FAILED: $1" >&2
  exit 1
}

echo "1. the plugin in the config"
printf '{"plugins": ["%s"]}\n' "$repo" >"$XDG_CONFIG_HOME/opencode/opencode.json"
# A port of its own, so a server the person already runs is never reused.
opencode service set port "$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')" >/dev/null

echo "2. OpenCode lists the skill"
# Skills are loaded once the server has booted, so the first answers can still be empty.
tries=0
until opencode api skill.list >"$work/skills.json" 2>&1 && grep -q '"id":"nido"' "$work/skills.json"; do
  tries=$((tries + 1))
  [ "$tries" -lt 30 ] || fail "OpenCode does not list the nido skill
$(head -c 2000 "$work/skills.json")"
  sleep 2
done

node -e '
  const { data } = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const skill = data.find((s) => s.id === "nido");
  if (!skill.description || skill.description.length < 40) throw new Error("the skill has no description");
  if (!skill.path.startsWith(process.argv[2])) throw new Error("the skill does not come from this package: " + skill.path);
  console.log("   nido: " + skill.description.slice(0, 80) + "…");
' "$work/skills.json" "$repo" || fail "the nido skill is not the one from this package"

echo
echo "Both passed."
