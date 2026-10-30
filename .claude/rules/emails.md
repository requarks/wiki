---
paths:
  - "backend/models/mail.ts"
  - "backend/models/locales.ts"
  - "backend/api/mail.ts"
  - "backend/notifications/mailer.ts"
  - "frontend/src/pages/AdminMail.vue"
---

# Emails

The wiki sends a registration confirmation, a forgotten password, the admin area's test, and
notifications (one at a time or as a digest — see [Notifications](./notifications.md)), and
`models/mail.ts` is the only place nodemailer is used. `send()` takes a `MailSite` from its caller
(`mail.siteFor(siteId, baseUrl)`) rather than a site id, because the notification mails are sent from
a worker thread, which has no `WIKI.sites` — it builds one with `mailSiteOf` from the config it
reads. `MailTemplateData` is the closed list, held as typed literals rather than rows in a table:
nothing sends a mail this wiki did not ask it to, so a template is part of the flow that uses it and
a flow that gained one would gain code there anyway. A wiki with no SMTP settings is the normal case, which is why `isConfigured` is
a question callers ask rather than something `send()` assumes.

**No mail is written in English in the code.** Every string lives in `locales/en.json` under
`mail.*` and is translated by the same CrowdIn pipeline the interface uses, so a locale somebody
translates arrives in the mails without anything here changing. Adding a template therefore means
adding its keys there, and there is no second place copy is kept.

**`locales.translator(code)` is how strings are resolved server-side** — a bound `{ locale, isRTL,
t }` rather than a `t(locale, key)` call, because the strings have to be fetched from the db and
everything that renders text does it one locale at a time and several strings at a time. Keys and
`{name}` placeholders are vue-i18n's, so a translator need not know which side of the wire a string
is rendered on. It is the first server-side translation in the codebase and is not mail-specific;
anything else the wiki writes for a person rather than for a machine belongs in it too.

- **Two fallbacks, and they are not the same thing.** A code naming a locale that is not installed —
  or is not a locale at all — is not used, which is also what stops an unvalidated value off a
  request body from putting an entry in the string cache. A locale that IS installed but is missing
  the key asked for falls back to `en` for that key alone, because a translation lags the release
  that added a string and a half-translated locale must not emit raw keys at a reader.
- **String sets are cached; locale metadata already was.** `getLocales` holds the rows, and
  `#stringsFor` holds the blobs — a few thousand entries the interface re-fetches per request and
  has no reason to keep, but which a mail reads a handful of keys out of. `reloadCache` drops them,
  which every install and update already calls and which the `reloadLocales` event runs on the other
  instances of an HA set.

**One description, two bodies.** A template returns a `MailContent` — subject, title, paragraphs, at
most one action, footer — and `htmlShell` and `textBody` are two renderings of it. Each template
used to write both out by hand, and a string changed in one was a string not changed in the other.
Everything in the description appears in both: the title is a heading in the HTML and a first line
in the text, and a paragraph written under a heading refers to it. Both open with the site's name —
beside its logo in the HTML — since the sender name alone does not tell two sites of one instance
apart. The logo is the PNG copy made when it is uploaded (`logoMail` in `models/sites.ts`), never the
stored WebP or SVG, which Outlook and Gmail respectively do not draw; a site with no copy, because
nothing was uploaded or Sharp is not installed, has the name alone.

**Which language a mail is written in is the caller's answer, not the model's.** `MailRequest.locale`
is what is known about the recipient, and what is known differs at every send site: an account's own
`prefs.locale`, the locale the browser filling the form was reading the wiki in, or nothing at all.
`localeFor` then falls back to the site's primary locale — the wiki's own language, which is the
right answer for a mail nobody has a preference on. The admin area's test button sends in the
language the admin area is being read in, so that it also shows what the templates say in it.

**`prefs.locale` is a language preference, not an interface setting.** It is edited under Profile →
Info and per-user in the admin user editor, and **registration seeds it from the locale the sign-up
form was filled in** — which is the only thing a brand new account has to go on, and means the
preference populates itself for anybody who signed up reading the wiki in their own language. What
the INTERFACE is drawn in is a different question with a different answer: on a page it is the
page's own locale, and elsewhere the locale picker's per-browser choice. See the locale block in
`App.vue`.

**The direction is declared three times on purpose.** Gmail and Outlook.com drop the `<html>` and
`<body>` elements and paste what is between them into their own document, taking any `dir` on them
with it — so an RTL mail read there comes out left-aligned unless the `<td>` that survives carries
the direction itself. The bare URL under a button stays `ltr` either way: a URL is not written in
the language around it, and bidi reordering makes one unreadable.

**Templates are not editable by an administrator**, and the stub that suggested they were — a
`@vue/repl` playground behind the experimental flag, wired to a Save button that did nothing and
importing a package the frontend does not have — is gone. Customization is a separate feature that
has not been built; if it is, the shape to keep is sparse overrides on top of the locale strings
rather than a replacement for them, so that a wiki that rewords one sentence keeps getting
translations and improvements for everything else.
