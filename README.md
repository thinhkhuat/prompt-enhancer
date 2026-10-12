# prompt-enhancer

A Claude Code mod that turns a rough prompt into a strong one, in place, before you send it. It adds a row above the prompt box with two buttons. **Enhance** rewrites your draft so that it:

- keeps your intent, scope and your own terms, word for word,
- states the kind of work and its domain, so the agent (and any skill router) can tell what it is,
- describes what the finished result looks like,
- stays as short as the request: a one-line ask becomes a few lines, not a page.

It names no skills you did not name and asks you no questions back: it leaves skill choice to the agent. These rules come from skill-concierge's concierge-enhancer, whose blind A/B on 20 real prompts found that naming skills and listing questions in the rewrite made the agent's skill menus worse.

The rewrite lands in the prompt box, where you can read it, edit it, and send it yourself.

```
Prompt enhancer [ Enhance ] [ Send ]  ctrl+x tab · e enhance · s send · esc back
────────────────────────────────────────────────────────────────────
❯ write a python script that summarizes my youtube watch history
```

## Use the row

1. Type a draft in the prompt box.
2. Press the focus chord that the row shows to move the focus to the row. The chord is `ctrl+x` `tab` unless you bind your own (see [Change the focus chord](#change-the-focus-chord)).
3. Press `e` to rewrite the draft, or `s` to send it.
4. Press `Esc` to go back to the prompt box without pressing a button.

You can also click **Enhance** or **Send** with the mouse.

- **Enhance** reads the draft, rewrites it, and replaces the draft with the rewrite (`hooks/register.tsx:75-99`). It never sends anything. While the rewrite runs, the row shows `Enhancing…` (`hooks/register.tsx:134-137`).
- **Send** clears the box and submits the draft as a turn (`hooks/register.tsx:101-111`).
- **The key hint** shows the focus chord, then `e enhance · s send · esc back` (`hooks/register.tsx:129`). `Esc` is Claude Code's built-in chord for leaving the row. While a turn runs, `s send` becomes `s queue`. The hint shows on the terminal only (`hooks/register.tsx:145`). On the desktop app and in VS Code, you click the buttons.
- **The hotkeys** are `e` for Enhance and `s` for Send (`hooks/register.tsx:141`, `hooks/register.tsx:143`). They work while the row has the focus.
- **An empty box** makes either button show a toast and do nothing else: "Type a prompt first" for Enhance, "Nothing to send" for Send (`hooks/register.tsx:78-81`, `hooks/register.tsx:103-106`).

## Use the row while a turn runs

The row stays above the prompt while Claude works, so you can prepare the next prompt mid-turn (`hooks/register.tsx:122`).

- **Enhance** forks the session the same way it does when idle. The fork runs as its own request and does not interrupt or change the running turn. It sees the conversation up to the last request the turn sent, so it misses the step still in flight.
- **Send** queues the draft. The prompt runs as its own turn after the running turn ends. This is not what Enter does: Claude Code delivers a prompt you type and send with Enter into the running turn.

## Change the focus chord

The chord that focuses the row belongs to Claude Code, not to the mod. It is the `abovePrompt:focus` action in the `Chat` context, and its built-in chord is `ctrl+x tab`. The action focuses every plugin row, so a new chord applies to other mods' rows too.

To add your own chord, add a `Chat` block to `~/.claude/keybindings.json`. On macOS, `cmd+e` is free in Claude Code:

```json
{
  "bindings": [
    { "context": "Chat", "bindings": { "cmd+e": "abovePrompt:focus" } },
    { "context": "AbovePrompt", "bindings": { "cmd+e": "abovePrompt:leave" } }
  ]
}
```

The second block makes the same chord a toggle: inside the row, `cmd+e` returns to the prompt box. `Esc` returns too, with or without that block.

If the file already has a `bindings` list, add the block to that list. On Linux and Windows, terminals rarely pass `cmd` keys through, so pick a chord that your terminal does send, such as `meta+e`. To turn off the built-in chord, map it to `null`: `"ctrl+x tab": null`.

The mod reads `keybindings.json` when a session starts and shows the chord in the row (`hooks/register.tsx:114-118`):

- If you bound a chord to `abovePrompt:focus` in a `Chat` block, the row shows that chord (`hooks/register.tsx:40-55`).
- If you did not, the row shows `ctrl+x tab`.
- If you mapped `ctrl+x tab` to `null` or to another action, and bound no chord of your own, the row shows only `e enhance · s send · esc back`.

The mod looks for the file in `$CLAUDE_CONFIG_DIR`, and in `~/.claude` when that variable is not set. If the file is missing or does not parse, the row shows `ctrl+x tab`. Start a new session after you edit the file, so that the row picks up the change.

## How a rewrite runs

Enhance sends one request: fixed rewrite rules (`hooks/register.tsx:16-28`) followed by your draft inside `<rough_prompt>` tags (`hooks/register.tsx:58`). Which model answers depends on whether the session has had a turn yet.

**After the first turn, the rewrite forks the session.** `$.model.fork` replays the main conversation's last request with the rewrite rules appended (`hooks/register.tsx:59`). The rewrite therefore sees everything that conversation sees:

- your `CLAUDE.md` files,
- the conversation so far.

This path gives the best rewrites. It runs on the session's own model, and no tool runs during the fork.

**Before the first turn, the rewrite falls back to `sonnet`.** A fresh session has nothing to fork, so `$.model.fork` answers `nothing-to-fork` (`hooks/register.tsx:61`). The mod then calls `$.model.complete` on `sonnet` (`hooks/register.tsx:12`, `hooks/register.tsx:64-70`). That call gets less context: only the project folder (`hooks/register.tsx:34-36`). It allows up to 4,000 output tokens and 120 seconds (`hooks/register.tsx:68-69`).

On either path, the mod keeps the text between `<prompt>` tags in the reply (`hooks/register.tsx:30-32`). Two cases stop the rewrite from replacing your draft:

- **You edited the draft while the rewrite ran.** The mod keeps your newer draft, throws the rewrite away, and says so in the row (`hooks/register.tsx:88-91`).
- **The model call failed, or the prompt box refused the text.** The row shows `Enhance failed: <reason>` and leaves your draft as it was (`hooks/register.tsx:93-95`).

## Install and uninstall

This folder is a marketplace of its own, named `prompt-enhancer` (`.claude-plugin/marketplace.json`). Its one entry points at the folder root, and the folder is published as the GitHub repository [`thinhkhuat/prompt-enhancer`](https://github.com/thinhkhuat/prompt-enhancer).

To install the mod, type this in a Claude Code terminal session:

```
/plugin install prompt-enhancer --marketplace thinhkhuat/prompt-enhancer
```

Claude Code asks `Add marketplace?`. Answer `y`, then press Enter to choose user scope. The mod is a hooks module only, so it starts in that session with no reload.

To install from a shell instead, run:

```sh
claude plugin marketplace add thinhkhuat/prompt-enhancer
claude plugin install prompt-enhancer@prompt-enhancer --scope user
```

`claude plugin list` then shows the mod:

```
  ❯ prompt-enhancer@prompt-enhancer
    Version: 0.1.3
    Scope: user
    Status: ✔ enabled
```

Claude Code runs a copy of the repository made at install time. To pick up a newer version pushed later, run these commands, then restart Claude Code:

```sh
claude plugin marketplace update prompt-enhancer
claude plugin update prompt-enhancer@prompt-enhancer
```

To uninstall the mod and remove the marketplace, run:

```sh
claude plugin uninstall prompt-enhancer@prompt-enhancer --scope user
claude plugin marketplace remove prompt-enhancer
```

## Develop the mod

### Files

| File | What it holds |
|---|---|
| `.claude-plugin/plugin.json` | The manifest: name, version, description, and the path to the state contract. |
| `.claude-plugin/marketplace.json` | Makes this folder a one-mod marketplace for GitHub installs. |
| `hooks/hooks.json` | Names the hooks module, `./register.tsx`. |
| `hooks/register.tsx` | The whole mod: a `session.start` hook that reads the focus chord, a `ui.render` hook on `AbovePrompt`, and the `enhance`, `send` and `rewrite` functions. |
| `types/index.d.ts` | The state contract: `isBusy`, `note`, and `focusKey`, kept in `$.state` under `prompt-enhancer`. |
| `tests/prompt-enhancer.test.ts` | Eight tests run by `claude plugin test`. |
| `tsconfig.json` | Points `tsc` at the API types that Claude Code writes into `.claude-plugin/types/`. |

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

All nine tests pass. The tests stand in for the prompt box, the model, the environment, and `keybindings.json`:

- **Fork path:** Enhance rewrites the draft in place from the forked session, and sends nothing (`tests/prompt-enhancer.test.ts:69`).
- **Fallback path:** Enhance falls back to a plain completion before the first turn (`tests/prompt-enhancer.test.ts:83`).
- **Failure:** Enhance leaves the draft alone and shows why when the model fails (`tests/prompt-enhancer.test.ts:97`).
- **Key hint:** the row shows the keys on `terminal` and not on `desktop` (`tests/prompt-enhancer.test.ts:110`).
- **During a turn:** the row stays while `isWorking` is true, Enhance still rewrites the draft, and the hint says `s queue` (`tests/prompt-enhancer.test.ts:121`).
- **Bound chord:** the hint shows the chord the user bound to `abovePrompt:focus` (`tests/prompt-enhancer.test.ts:163`).
- **No file:** the hint falls back to `ctrl+x tab` without a `keybindings.json` (`tests/prompt-enhancer.test.ts:173`).
- **Unbound default:** the hint drops the chord when the user unbound `ctrl+x tab` and bound nothing else (`tests/prompt-enhancer.test.ts:178`).
- **Send:** Send submits the draft as the user's own words and clears the box (`tests/prompt-enhancer.test.ts:185`).

The first five tests and the Send test run once on the `terminal` surface and once on the `desktop` surface.

### Type-check

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`. Claude Code writes that folder, with this version's API types, each time it loads the mod from this folder. The folder is not in git.

1. To write the types, start Claude Code once with this folder as a plugin folder, then quit:

```sh
claude --plugin-dir .
```

2. Run:

```sh
npx -y -p typescript@5 tsc -p .
```

A clean run prints nothing and exits 0. A type error prints its file, line, and message, for example `hooks/register.tsx(159,7): error TS2322`.

### Ship an edit

To try an edit before you ship it, start Claude Code with this folder as a plugin folder. The folder's copy then replaces the installed copy for that session only:

```sh
claude --plugin-dir .
```

The installed copy comes from GitHub, so an edit in this folder reaches your sessions only after you push it:

1. Raise `version` in `.claude-plugin/plugin.json`, for example from `0.1.3` to `0.1.4`. `claude plugin update` compares versions, not commits: a pushed commit with the same version stays at `already at the latest version`.
2. Commit and push the change to `thinhkhuat/prompt-enhancer`.
3. Run the two update commands in [Install and uninstall](#install-and-uninstall).
4. Restart Claude Code.

## Known limits

- **The transcript labels a sent prompt as coming from the plugin.** Send submits with `asUser: true` (`hooks/register.tsx:110`). The model reads the text as your own words, with no "plugin sent a message" frame. The transcript still shows `› Prompt from the prompt-enhancer plugin` above it, though, and Claude Code does not expand `@file` mentions in a prompt a plugin submits. The mod cannot change either behaviour. To send the prompt as an ordinary typed prompt, press Enter in the box instead of Send.
- **A mid-turn rewrite can miss the latest step.** The fork replays the last request the running turn sent. Output the turn produced after that request is not in the rewrite's context.
- **The hint can show `ctrl+x tab` for a moment at session start.** The row can draw before the mod has read `keybindings.json`. It shows your chord once the read finishes.
- **A long draft can push the row off screen.** In live runs on a 50-row terminal, Claude Code stopped drawing the row once a 30-line rewrite filled the prompt box. The mod still returned the row. On a 150-row terminal, the same rewrite left the row visible. The focus chord and the hotkeys still reached the row while it was hidden.
- **Enhance is not awaited, because a press has 10 seconds.** Claude Code gives each `ui.press` hook a 10-second budget (`HookBudget.ms` is `10_000` in `claude-code.d.ts`). A forked rewrite can take longer: one live run took 13.9 seconds and logged `ui.press prompt-enhancer: exceeded 10000ms budget`. So the button starts `enhance` and returns without waiting for it (`hooks/register.tsx:140-141`). The `isBusy` flag stops a second press from starting a second rewrite while the first one runs (`hooks/register.tsx:76`, `hooks/register.tsx:82`).
- **A rewrite can include your absolute project path.** The rules tell the model to fit the project, and the path is part of the context the model sees (`hooks/register.tsx:23`, `hooks/register.tsx:35`).
- **The hint reads `keybindings.json` only when a session starts.** An edit to the file shows in the row from the next session on.
- **A `cmd` chord works only where the terminal sends `cmd` keys.** tmux does not pass them through.

These limits come from a live verification run on Claude Code 2.1.296 (2026-10-11).
