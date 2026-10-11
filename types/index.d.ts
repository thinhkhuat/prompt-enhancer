export type EnhancerNote = string | null

declare module 'claude-code' {
  interface PluginState {
    'prompt-enhancer': {
      isBusy: boolean
      note: EnhancerNote
      focusKey: string | null
    }
  }
}
