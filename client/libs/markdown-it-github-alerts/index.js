// ------------------------------------
// Markdown - GitHub-style Alerts (Client-side)
// ------------------------------------

function githubAlertsPlugin(md, options = {}) {
  const alertTypes = {
    'note': { class: 'is-info' },
    'info': { class: 'is-info' },
    'tip': { class: 'is-success' },
    'warning': { class: 'is-warning' },
    'important': { class: 'is-info' },
    'caution': { class: 'is-danger' }
  }

  // Store original renderer - will handle line number injection if it exists
  const defaultRender = md.renderer.rules.blockquote_open || function(tokens, idx, options, env, slf) {
    return slf.renderToken(tokens, idx, options)
  }

  // Override blockquote_open renderer to handle both alerts and line numbers
  md.renderer.rules.blockquote_open = function(tokens, idx, opts, env, slf) {
    const nextToken = tokens[idx + 1]

    // Check if the next token is a paragraph containing inline content
    if (nextToken && nextToken.type === 'paragraph_open') {
      const inlineToken = tokens[idx + 2] // The inline token after paragraph_open

      if (inlineToken && inlineToken.type === 'inline' && inlineToken.children) {
        const firstChild = inlineToken.children[0]

        if (firstChild && firstChild.type === 'text') {
          const content = firstChild.content
          const alertMatch = content.match(/^\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|CAUTION)\]/i)

          if (alertMatch) {
            const alertType = alertMatch[1].toLowerCase()

            const alertConfig = alertTypes[alertType]
            if (alertConfig) {
              // Add CSS class to blockquote
              tokens[idx].attrJoin('class', alertConfig.class)

              // Remove the alert tag
              firstChild.content = firstChild.content.replace(/^\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|CAUTION)\]\s*/i, '')

              // If we emptied the first text node, remove it
              if (firstChild.content === '') {
                inlineToken.children.shift()
                // Also remove the following softbreak if it exists
                if (inlineToken.children[0] && inlineToken.children[0].type === 'softbreak') {
                  inlineToken.children.shift()
                }
              }
            }
          }
        }
      }
    }

    return defaultRender(tokens, idx, opts, env, slf)
  }
}

module.exports = githubAlertsPlugin
