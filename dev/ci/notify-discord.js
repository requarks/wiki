// Posts a release announcement to a Discord channel through a webhook. Run by the
// "Notify Discord Channel" step of .github/workflows/build.yml, which provides REL_VERSION and the
// webhook URL.

const { REL_VERSION, DISCORD_WEBHOOK } = process.env

for (const [name, value] of Object.entries({ REL_VERSION, DISCORD_WEBHOOK })) {
  if (!value) {
    throw new Error(`${name} is not set`)
  }
}

const res = await fetch(DISCORD_WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: `Wiki.js ${REL_VERSION} has been released! See https://github.com/requarks/wiki/releases for details.`
  })
})
if (!res.ok) {
  throw new Error(`Discord webhook failed (${res.status}): ${await res.text()}`)
}
