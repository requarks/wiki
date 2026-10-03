// Posts a release announcement to Bluesky. Run by the "Notify Bluesky" step of
// .github/workflows/build.yml, which provides REL_VERSION and the account's credentials.

const pds = 'https://bsky.social'
const { REL_VERSION, BSKY_HANDLE, BSKY_APP_PASSWORD } = process.env

for (const [name, value] of Object.entries({ REL_VERSION, BSKY_HANDLE, BSKY_APP_PASSWORD })) {
  if (!value) {
    throw new Error(`${name} is not set`)
  }
}

const url = `https://github.com/requarks/wiki/releases/tag/${REL_VERSION}`
const prefix = `Wiki.js ${REL_VERSION} has been released! Release notes: `
const text = prefix + url

async function xrpc(method, body, token) {
  const res = await fetch(`${pds}/xrpc/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    throw new Error(`${method} failed (${res.status}): ${await res.text()}`)
  }
  return res.json()
}

const session = await xrpc('com.atproto.server.createSession', {
  identifier: BSKY_HANDLE,
  password: BSKY_APP_PASSWORD
})

// Bluesky does not auto-link URLs in post text: a link is a facet over its UTF-8 byte range
const byteStart = Buffer.byteLength(prefix)
await xrpc(
  'com.atproto.repo.createRecord',
  {
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
      facets: [
        {
          index: { byteStart, byteEnd: byteStart + Buffer.byteLength(url) },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }]
        }
      ]
    }
  },
  session.accessJwt
)
