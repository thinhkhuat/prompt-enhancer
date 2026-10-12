import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isBusy = atom({ plugin: 'prompt-enhancer', key: 'isBusy' } as const, false)
const note = atom({ plugin: 'prompt-enhancer', key: 'note' } as const, null)

// Claude Code's own action for focusing plugin rows, and its built-in chord.
const FOCUS_ACTION = 'abovePrompt:focus'
const DEFAULT_FOCUS_KEY = 'ctrl+x tab'
const focusKey = atom({ plugin: 'prompt-enhancer', key: 'focusKey' } as const, DEFAULT_FOCUS_KEY)

const FALLBACK_MODEL = 'sonnet'

// Ported from skill-concierge's concierge-enhancer v0.1, whose blind A/B on 20 real prompts showed
// that naming skills and asking the author questions made the downstream skill menus worse.
const RULES = `Goal: rewrite the rough prompt below into the message the author would send with one more minute: the same request, stated so a coding agent in this project can act on it from start to finish.

Success means the rewrite:
1. Keeps the author's intent, scope and language; every requirement comes from what they asked for or clearly implied.
2. Copies the author's own terms verbatim: tools, files, procedures, people, and any coined or misspelled term ("chisle" stays "chisle").
3. States the kind of work and its domain: what is built, fixed, reviewed, researched or written, and the tools, file types, services and artifacts involved.
4. Describes the finished result: the deliverable and how to tell it is done.
5. Fits this project, using only the paths and facts its folder, files, conventions and the conversation show.
6. Leaves skill choice to the agent: it names skills, plugins, agents or slash commands only where the author did.
7. Matches its length to the request: a one-line ask stays a few lines, and every added line carries a fact the agent needs.

Write it in the author's voice, as the message they will send, in plain sentences or short bullets.
Reply with the rewritten prompt only, wrapped in <prompt></prompt>. Stop after </prompt>.`

const extract = (reply: string) => {
  return (reply.match(/<prompt>([\s\S]*?)<\/prompt>/)?.[1] ?? reply).trim()
}

async function fallbackContext($: EngineInterface): Promise<string> {
  return `Project folder: ${await $.session.cwd()}`
}

// The chord that focuses the row, as the user's keybindings.json has it: their own
// Chat binding of abovePrompt:focus first, else the built-in chord unless they rebound it.
async function readFocusKey($: EngineInterface): Promise<string | null> {
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? `${await $.env.get('HOME')}/.claude`
  const chat: Record<string, string | null> = {}
  try {
    const file = JSON.parse(String(await $.fs.read(`${dir}/keybindings.json`)))
    for (const block of file.bindings ?? []) {
      if (block.context !== 'Chat') continue
      for (const [chord, action] of Object.entries(block.bindings ?? {})) chat[chord.toLowerCase()] = action as string | null
    }
  } catch {
    // No keybindings.json, or one that doesn't parse: Claude Code uses its defaults.
  }
  const own = Object.keys(chat).find(chord => chat[chord] === FOCUS_ACTION)
  if (own) return own
  return DEFAULT_FOCUS_KEY in chat ? null : DEFAULT_FOCUS_KEY
}

async function rewrite($: EngineInterface, draft: string): Promise<string> {
  const ask = `${RULES}\n\n<rough_prompt>\n${draft}\n</rough_prompt>`
  const forked = await $.model.fork({ prompt: ask })
  if (forked.isAnswered) return extract(forked.text)
  if (forked.reason !== 'nothing-to-fork') throw new Error(`model call failed: ${forked.reason}`)

  // No conversation to fork yet (fresh session): ask without the session's context.
  const done = await $.model.complete({
    model: FALLBACK_MODEL,
    system: await fallbackContext($),
    prompt: ask,
    maxTokens: 4000,
    timeoutMs: 120_000,
  })
  if (!done.isAnswered) throw new Error(`model call failed: ${done.reason}`)
  return extract(done.text)
}

async function enhance($: EngineInterface) {
  if (await read($, isBusy)) return
  const { text } = await $.prompt.read()
  if (!text.trim()) {
    $.ui.toast('Type a prompt first')
    return
  }
  await update($, isBusy, () => true)
  await update($, note, () => null)
  try {
    const better = await rewrite($, text)
    if (!better) throw new Error('empty rewrite')
    // The person may have kept typing; keep their newer draft rather than clobber it.
    if ((await $.prompt.read()).text !== text) {
      await update($, note, () => 'Draft changed while enhancing; rewrite discarded')
      return
    }
    const filled = await $.prompt.fill({ text: better })
    if (!filled.isFilled) throw new Error(`prompt box refused (${filled.refusal ?? 'unknown'})`)
  } catch (err) {
    await update($, note, () => `Enhance failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    await update($, isBusy, () => false)
  }
}

async function send($: EngineInterface) {
  const { text } = await $.prompt.read()
  if (!text.trim()) {
    $.ui.toast('Nothing to send')
    return
  }
  await $.prompt.fill({ text: '' })
  await update($, note, () => null)
  // asUser: the model reads it as the person's own words, not framed as a plugin message.
  await $.prompt.submit({ text, asUser: true })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const chord = await readFocusKey($)
    await update($, focusKey, () => chord)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The row stays during a running turn: Enhance forks without touching it, and Send queues behind it.
    // A survey holds the band: yield to it.
    if (e.props.hasSurvey) return next(e)

    // Compose: this row, and beneath it whatever the rest of the chain drew (another plugin's band, the engine's).
    const below = await next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const busy = await read($, isBusy)
    const message = await read($, note)
    const chord = await read($, focusKey)
    // esc is Claude Code's built-in abovePrompt:leave chord: it returns focus to the prompt box.
    const hint = [chord, 'e enhance', e.props.isWorking ? 's queue' : 's send', 'esc back'].filter(Boolean).join(' · ')

    const row = (
      <Box>
        <Text dimColor>Prompt enhancer </Text>
        {busy ? (
          <Text dimColor>
            Enhancing…
          </Text>
        ) : (
          <Box>
            {/* Not awaited: a rewrite can outlast the 10s ui.press budget; isBusy guards re-entry. */}
            <Button key="enhance" label="Enhance" hotkey="e" variant="primary" onPress={() => void enhance($)} />
            <Text> </Text>
            <Button key="send" label="Send" hotkey="s" onPress={() => send($)} />
            {/* The focus chord is a terminal keybinding; other surfaces click. */}
            {e.surface === 'terminal' ? <Text dimColor>  {hint}</Text> : null}
          </Box>
        )}
        {message ? (
          <Text dimColor>
            {' '}
            {message}
          </Text>
        ) : null}
      </Box>
    )

    return (
      <Box flexDirection="column">
        {row}
        {below}
      </Box>
    )
  })
}
