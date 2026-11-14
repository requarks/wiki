import { ref } from 'vue'

/**
 * A reader's answer to the site's cookie consent banner (Admin → General).
 *
 * Kept in a cookie rather than in local storage because the SERVER is what acts on it: the analytics
 * tags are served in the document, not added by the app, and `analyticsInjections` in
 * `backend/helpers/appShell.ts` leaves them out unless this cookie says `all`. So the name has to
 * agree with `CONSENT_COOKIE` there. Scoped to the hostname, which is what a site is.
 *
 * The three answers:
 * - `acknowledged` — the banner was dismissed while the site offered no choice, because it served no
 *   analytics. Asked again once it does, since nobody has said yes or no to tracking yet.
 * - `necessary` — strictly necessary cookies only. No tag is served.
 * - `all` — necessary and tracking cookies. The tags are served.
 */
export const CONSENT_COOKIE = 'wikiConsent'

const ANSWERS = ['acknowledged', 'necessary', 'all']

/** How long an answer stands before the reader is asked again: six months. */
const MAX_AGE_SECONDS = 180 * 24 * 60 * 60

function readConsent() {
  const entry = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
  const value = entry?.slice(CONSENT_COOKIE.length + 1) ?? null
  return ANSWERS.includes(value) ? value : null
}

/** The current answer, or null for a reader who has not given one. */
export const consent = ref(readConsent())

/** Whether the reader reopened the banner to change their answer (the footer's link). */
export const consentPromptReopened = ref(false)

/**
 * Record the reader's answer.
 *
 * Where it changes whether tracking is allowed, the page is reloaded: accepting is what gets the
 * server to put the tags in the document, and withdrawing is the only way to stop a tag that is
 * already running — a script cannot be unloaded.
 *
 * @param {'acknowledged'|'necessary'|'all'} answer
 */
export function setConsent(answer) {
  const previous = consent.value
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${answer}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  consent.value = answer
  consentPromptReopened.value = false
  if ((previous === 'all') !== (answer === 'all')) {
    window.location.reload()
  }
}

/** Show the banner again, for a reader changing their mind. */
export function reopenConsentPrompt() {
  consentPromptReopened.value = true
}
