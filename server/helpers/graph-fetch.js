/**
 * Minimal GraphQL fetch client (replaces apollo-fetch), using native fetch
 */
module.exports = {
  createGraphFetch ({ uri }) {
    return async ({ query, variables = {} }) => {
      const resp = await fetch(uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      })
      if (!resp.ok) {
        throw new Error(`Unexpected response code ${resp.status} from ${uri}`)
      }
      return resp.json()
    }
  }
}
