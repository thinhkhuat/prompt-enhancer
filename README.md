# prompt-enhancer

A Claude Code mod that turns a rough prompt into a strong one, in place, before you send it. It adds a row above the prompt box with two buttons. **Enhance** rewrites your draft so that it:

- names the installed skills that fit,
- lists the decisions Claude should ask you about first,
- describes what the finished result looks like.

The rewrite lands in the prompt box, where you can read it, edit it, and send it yourself.

```
Prompt enhancer [ Enhance ] [ Send ]  ctrl+x tab · e enhance · s send
────────────────────────────────────────────────────────────────────
❯ write a python script that summarizes my youtube watch history
```

## Use the row

1. Type a draft in the prompt box.
2. Press `ctrl+x` `tab` to move the focus to the row.
3. Press `e` to rewrite the draft, or `s` to send it.

You can also click **Enhance** or **Send** with the mouse.

- **Enhance** reads the draft, rewrites it, and replaces the draft with the rewrite (`hooks/register.tsx:53-77`). It never sends anything. While the rewrite runs, the row shows `Enhancing…` (`hooks/register.tsx:102-105`).
- **Send** clears the box and submits the draft as a turn (`hooks/register.tsx:79-89`).
- **The key hint** `ctrl+x tab · e enhance · s send` shows on the terminal only (`hooks/register.tsx:113`). On the desktop app and in VS Code, you click the buttons.
- **The hotkeys** are `e` for Enhance and `s` for Send (`hooks/register.tsx:109`, `hooks/register.tsx:111`). They work while the row has the focus.
- **An empty box** makes either button show a toast and do nothing else: "Type a prompt first" for Enhance, "Nothing to send" for Send (`hooks/register.tsx:56-59`, `hooks/register.tsx:81-84`).

## How a rewrite runs

Enhance sends one request: fixed rewrite rules (`hooks/register.tsx:9-19`) followed by your draft inside `<rough_prompt>` tags (`hooks/register.tsx:36`). Which model answers depends on whether the session has had a turn yet.

**After the first turn, the rewrite forks the session.** `$.model.fork` replays the main conversation's last request with the rewrite rules appended (`hooks/register.tsx:37`). The rewrite therefore sees everything that conversation sees:

- your `CLAUDE.md` files,
- the full skill listing with descriptions,
- the conversation so far.

This path gives the best rewrites. It runs on the session's own model, and no tool runs during the fork.

**Before the first turn, the rewrite falls back to `sonnet`.** A fresh session has nothing to fork, so `$.model.fork` answers `nothing-to-fork` (`hooks/register.tsx:39`). The mod then calls `$.model.complete` on `sonnet` (`hooks/register.tsx:7`, `hooks/register.tsx:42-48`). That call gets less context: only the project folder and the names of the installed skills, without their descriptions (`hooks/register.tsx:25-33`). It allows up to 4,000 output tokens and 120 seconds (`hooks/register.tsx:46-47`).

On either path, the mod keeps the text between `<prompt>` tags in the reply (`hooks/register.tsx:21-23`). Two cases stop the rewrite from replacing your draft:

- **You edited the draft while the rewrite ran.** The mod keeps your newer draft, throws the rewrite away, and says so in the row (`hooks/register.tsx:66-69`).
- **The model call failed, or the prompt box refused the text.** The row shows `Enhance failed: <reason>` and leaves your draft as it was (`hooks/register.tsx:71-73`).

## Install and uninstall

### Install from the local `tk-mods` marketplace

The parent folder `mods-dev/` is a local marketplace named `tk-mods`. To install the mod for every session at user scope, run:

```sh
claude plugin marketplace add ~/in-PROD/MY-WORKBENCH/mods-dev
claude plugin install prompt-enhancer@tk-mods --scope user
```

`claude plugin list` then shows the mod and says where Claude Code reads it from:

```
  ❯ prompt-enhancer@tk-mods
    Version: 0.1.0
    Read from: /Users/thinhkhuat/in-PROD/MY-WORKBENCH/mods-dev/prompt-enhancer
    Scope: user
    Status: ✔ enabled
```

Claude Code reads the mod straight from this folder. A session picks up an edit after `/reload-plugins`, with no reinstall.

To uninstall the mod and remove the marketplace, run:

```sh
claude plugin uninstall prompt-enhancer@tk-mods --scope user
claude plugin marketplace remove tk-mods
```

### Install from GitHub

This folder is also a marketplace of its own, named `prompt-enhancer` (`.claude-plugin/marketplace.json`). Its one entry points at the folder root. Once the folder is published as the GitHub repository `thinhkhuat/prompt-enhancer`, anyone can install the mod. In a Claude Code terminal session, type:

```
/plugin install prompt-enhancer --marketplace thinhkhuat/prompt-enhancer
```

Claude Code asks `Add marketplace?`. Answer `y`, then press Enter to choose user scope. The mod is a hooks module only, so it starts in that session with no reload.

## Develop the mod

### Files

| File | What it holds |
|---|---|
| `.claude-plugin/plugin.json` | The manifest: name, version, description, and the path to the state contract. |
| `.claude-plugin/marketplace.json` | Makes this folder a one-mod marketplace for GitHub installs. |
| `hooks/hooks.json` | Names the hooks module, `./register.tsx`. |
| `hooks/register.tsx` | The whole mod: one `ui.render` hook on `AbovePrompt`, plus the `enhance`, `send` and `rewrite` functions. |
| `types/index.d.ts` | The state contract: `isBusy` and `note`, kept in `$.state` under `prompt-enhancer`. |
| `tests/prompt-enhancer.test.ts` | Five tests run by `claude plugin test`. |

### Validate and test

To check the manifest, the marketplace file, and the hooks module the way the engine reads them, run this from the mod folder:

```sh
claude plugin validate .
```

The last line is `✔ Validation passed with warnings`. The warnings are about missing `author` fields only.

To run the tests against the engine itself, run:

```sh
claude plugin test .
```

All five tests pass. Each test that draws the row runs once on the `terminal` surface and once on the `desktop` surface. The tests stand in for the prompt box and the model:

- **Fork path:** Enhance rewrites the draft in place from the forked session, and sends nothing (`tests/prompt-enhancer.test.ts:69`).
- **Fallback path:** Enhance falls back to a plain completion before the first turn (`tests/prompt-enhancer.test.ts:83`).
- **Failure:** Enhance leaves the draft alone and shows why when the model fails (`tests/prompt-enhancer.test.ts:97`).
- **Key hint:** the row shows the keys on `terminal` and not on `desktop` (`tests/prompt-enhancer.test.ts:110`).
- **Send:** Send submits the draft as the user's own words and clears the box (`tests/prompt-enhancer.test.ts:121`).

### Type-check

The mod has no `tsconfig.json` of its own. The engine's API types live in `claude-code.d.ts`. Claude Code writes that file to a temporary folder when the `plugin-authoring` skill loads, and the folder changes from one Claude Code process to the next. Find the file and write the `tsconfig.json` outside the mod each time.

1. In a Claude Code session, type `/plugin-authoring` so that the current types file exists.
2. In a shell, from this folder, run:

```sh
V=$(claude --version | cut -d' ' -f1)
DTS=$(ls -t "${CLAUDE_CODE_TMPDIR:-$TMPDIR}"/claude-$(id -u)/bundled-skills/"$V"/*/plugin-authoring/types/claude-code.d.ts | head -1)
MOD=$PWD
TC=$(mktemp -d)
cat > "$TC/tsconfig.json" <<EOF
{
  "compilerOptions": {
    "target": "es2023", "lib": ["es2023"], "types": [],
    "module": "esnext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true,
    "noEmit": true, "skipLibCheck": true,
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": ["$DTS", "$MOD/hooks", "$MOD/types", "$MOD/tests"]
}
EOF
npx -y -p typescript@5 tsc -p "$TC" && echo "tsc: 0 errors"
```

A clean run prints `tsc: 0 errors`. If `ls` finds no `claude-code.d.ts` file, step 1 did not run in this Claude Code version.

### Reload after an edit

Claude Code reads the installed mod straight from this folder. After you save a change, type `/reload-plugins` in a session. The reload names the mod:

```
prompt-enhancer@tk-mods re-read from its folder: ~/in-PROD/MY-WORKBENCH/mods-dev/prompt-enhancer
```

## Known limits

- **The transcript labels a sent prompt as coming from the plugin.** Send submits with `asUser: true` (`hooks/register.tsx:88`). The model reads the text as your own words, with no "plugin sent a message" frame. The transcript still shows `› Prompt from the prompt-enhancer plugin` above it, though, and Claude Code does not expand `@file` mentions in a prompt a plugin submits. The mod cannot change either behaviour. To send the prompt as an ordinary typed prompt, press Enter in the box instead of Send.
- **The row hides while a turn runs.** The hook steps aside while `isWorking` or `hasSurvey` is true (`hooks/register.tsx:93`). The row comes back when the turn ends.
- **A long draft can push the row off screen.** In live runs on a 50-row terminal, Claude Code stopped drawing the row once a 30-line rewrite filled the prompt box. The mod still returned the row. On a 150-row terminal, the same rewrite left the row visible. `ctrl+x` `tab` and the hotkeys still reached the row while it was hidden.
- **Enhance is not awaited, because a press has 10 seconds.** Claude Code gives each `ui.press` hook a 10-second budget (`HookBudget.ms` is `10_000` in `claude-code.d.ts`). A forked rewrite can take longer: one live run took 13.9 seconds and logged `ui.press prompt-enhancer: exceeded 10000ms budget`. So the button starts `enhance` and returns without waiting for it (`hooks/register.tsx:108-109`). The `isBusy` flag stops a second press from starting a second rewrite while the first one runs (`hooks/register.tsx:54`, `hooks/register.tsx:60`).
- **A rewrite can include your absolute project path.** The rules tell the model to fit the project, and the path is part of the context the model sees (`hooks/register.tsx:16`, `hooks/register.tsx:30`).

These limits come from a live verification run on Claude Code 2.1.296 (2026-10-11).
