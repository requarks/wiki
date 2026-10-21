/**
 * How each MCP client is told about this wiki: the endpoint and a bearer token, in whatever form that
 * client's configuration takes. Shown by `McpConnectSnippets.vue` on Admin → MCP, on Profile → Access
 * Tokens, and in the dialog that shows a new token once — there with the token filled in.
 *
 * The clients a person sets up by hand. The remote connectors (claude.ai, ChatGPT) take the URL alone
 * and sign in through OAuth, which is not built yet; see `dev/specs/mcp.md` §4.3.
 */

/** What the token placeholder reads before there is a token to put there. */
export const TOKEN_PLACEHOLDER = 'YOUR-TOKEN'

/** The server's name in the client's configuration. */
const SERVER_NAME = 'wiki'

export const MCP_CLIENTS = [
  {
    key: 'claudeCode',
    label: 'Claude Code',
    snippet: (url, token) =>
      `claude mcp add --transport http ${SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`
  },
  {
    key: 'vscode',
    label: 'VS Code',
    // -> `.vscode/mcp.json`, whose top-level key is `servers` and which wants the transport named
    snippet: (url, token) =>
      JSON.stringify(
        {
          servers: {
            [SERVER_NAME]: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } }
          }
        },
        null,
        2
      )
  },
  {
    key: 'cursor',
    label: 'Cursor',
    // -> `~/.cursor/mcp.json`, whose top-level key is `mcpServers`
    snippet: (url, token) =>
      JSON.stringify(
        { mcpServers: { [SERVER_NAME]: { url, headers: { Authorization: `Bearer ${token}` } } } },
        null,
        2
      )
  }
]

/** The endpoint for the site the browser is on: each site answers on its own hostname. */
export function mcpEndpointUrl() {
  return `${window.location.origin}/_mcp`
}
