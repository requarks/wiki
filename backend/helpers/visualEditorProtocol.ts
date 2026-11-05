/**
 * The visual document shape understood by this browser build.
 *
 * Shared with the frontend. This is a compatibility marker, not a permission or a secret. Changing
 * the Yjs representation requires a new value and a coordinated restart of all backend instances.
 */
export const VISUAL_EDITOR_SCHEMA = 'image-links-1'
export const VISUAL_EDITOR_SCHEMA_HEADER = 'x-wiki-visual-schema'
export const VISUAL_EDITOR_RELOAD_MESSAGE =
  'The visual editor has been updated. Keep a separate copy of unsaved work, then reload this page before saving.'

/**
 * Old browser tabs must not write their already-decoded visual document back as Markdown. Metadata
 * edits carry no such document. API-token writers intentionally author source rather than using the
 * browser's ProseMirror/Yjs binding; their existing permissions and scopes still apply unchanged.
 */
export function visualSaveNeedsReload(
  editor: string | null | undefined,
  patch: { content?: unknown; render?: unknown },
  clientSchema: unknown,
  usesApiKey: boolean
): boolean {
  return (
    editor === 'visual' &&
    (patch.content !== undefined || patch.render !== undefined) &&
    !usesApiKey &&
    clientSchema !== VISUAL_EDITOR_SCHEMA
  )
}
