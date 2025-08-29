// ------------------------------------
// Markdown - GitHub-style Alerts
// ------------------------------------

module.exports = {
  init (md, conf) {
    // Plugin to parse GitHub-style alerts
    md.use(githubAlertsPlugin, conf)
  }
}

function githubAlertsPlugin(md, options = {}) {
  const alertTypes = {
    'note': { enabled: options.enableNoteAlert !== false, class: 'is-info' },
    'info': { enabled: options.enableNoteAlert !== false, class: 'is-info' },
    'tip': { enabled: options.enableTipAlert !== false, class: 'is-success' },
    'warning': { enabled: options.enableWarningAlert !== false, class: 'is-warning' },
    'important': { enabled: options.enableImportantAlert !== false, class: 'is-info' },
    'caution': { enabled: options.enableCautionAlert !== false, class: 'is-danger' }
  }

  // Add custom rule to transform GitHub alert syntax
  md.core.ruler.before('normalize', 'github_alerts', function(state) {
    let pos = 0
    let lines = state.src.split('\n')
    let processedLines = []

    while (pos < lines.length) {
      const line = lines[pos]

      // Check if this line starts a potential GitHub alert blockquote
      if (line.trim().startsWith('> [!')) {
        const alertMatch = line.match(/^>\s*\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|CAUTION)\](?:\s+(.+?))?\s*$/i)

        if (alertMatch) {
          const alertType = alertMatch[1].toLowerCase()
          const customTitle = alertMatch[2] ? alertMatch[2].trim() : null

          // Check if this alert type is enabled
          const alertConfig = alertTypes[alertType]
          if (alertConfig && alertConfig.enabled) {
            // Collect all blockquote lines for this alert
            let blockquoteLines = []
            let currentPos = pos + 1

            // Add the title line if there's a custom title
            if (customTitle && options.customTitle !== false) {
              blockquoteLines.push(`> **${customTitle}**`)
            }

            // Collect subsequent blockquote lines
            while (currentPos < lines.length && lines[currentPos].trim().startsWith('>')) {
              blockquoteLines.push(lines[currentPos])
              currentPos++
            }

            // If we have content, add the class attribute to the last line
            if (blockquoteLines.length > 0) {
              const lastLineIndex = blockquoteLines.length - 1
              blockquoteLines[lastLineIndex] += ` {.${alertConfig.class}}`
            } else {
              // If no content, create a line with just the class
              blockquoteLines.push(`> {.${alertConfig.class}}`)
            }

            processedLines = processedLines.concat(blockquoteLines)

            pos = currentPos
            continue
          }
        }
      }

      processedLines.push(line)
      pos++
    }

    state.src = processedLines.join('\n')
  })
}


