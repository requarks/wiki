import type { NotificationEvent } from './types.ts'

/**
 * What an entry remembers about an event, so that it can still be drawn after the page has been
 * renamed, moved or deleted and the actor's account has gone.
 *
 * The page is copied without its tags — they are what access is checked against, not something an
 * inbox shows — and `variants` is what lets a coalesced entry say "edited 4 times and moved" rather
 * than only what the last event did.
 */
export function snapshotOf(event: NotificationEvent): Record<string, unknown> {
  const { page, variants, variant, previousPath, previousLocale, actorName, excerpt } = event.data
  return {
    ...(page && {
      page: { id: page.id, title: page.title, path: page.path, locale: page.locale }
    }),
    variants: variants ?? [variant],
    ...(previousPath !== undefined && { previousPath, previousLocale }),
    actorName: actorName ?? null,
    ...(excerpt !== undefined && { excerpt }),
    ...(event.data.submissionId && { submissionId: event.data.submissionId }),
    // -> Said in the entry when nobody did it by hand, which is the case where the actor named is
    //    the account the sync runs as rather than whoever made the change
    ...(event.origin !== 'user' && { origin: event.origin })
  }
}
