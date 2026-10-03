// Posts a release announcement to a Telegram channel through the Bot API. Run by the
// "Notify Telegram Channel" step of .github/workflows/build.yml, which provides REL_VERSION, the
// bot token and the chat to post in.

const { REL_VERSION, TELEGRAM_TOKEN, TELEGRAM_TO } = process.env

for (const [name, value] of Object.entries({ REL_VERSION, TELEGRAM_TOKEN, TELEGRAM_TO })) {
  if (!value) {
    throw new Error(`${name} is not set`)
  }
}

const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: TELEGRAM_TO,
    parse_mode: 'Markdown',
    link_preview_options: { is_disabled: true },
    text: [
      `Wiki.js *${REL_VERSION}* has been released!`,
      'See [release notes](https://github.com/requarks/wiki/releases) for details.'
    ].join('\n')
  })
})
if (!res.ok) {
  // The token is part of the URL, so report the API's description rather than the request
  throw new Error(`sendMessage failed (${res.status}): ${await res.text()}`)
}
