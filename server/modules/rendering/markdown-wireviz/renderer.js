const { spawnSync } = require('child_process')

module.exports = {
  init(mdinst, conf = {}) {
    this.md = mdinst
    this.conf = conf
    this.logger = (typeof WIKI !== 'undefined' && WIKI.logger) ? WIKI.logger : console
    this.wirevizWebUrl =
      conf.wirevizWebUrl ||
      'http://localhost:3005'

    const originalFence = mdinst.renderer.rules.fence || null

    mdinst.renderer.rules.fence = (tokens, idx, options, env, slf) => {
      const token = tokens[idx]
      const info = (token.info || '').trim()

      if (!info || !info.startsWith('wireviz')) {
        return originalFence
          ? originalFence(tokens, idx, options, env, slf)
          : `<pre><code>${mdinst.utils.escapeHtml(token.content)}</code></pre>`
      }

      const wirevizCode = token.content || ''

      try {
        const html = this.renderViaWirevizWebSync(wirevizCode)
        return `<div class="wireviz-diagram">${html}</div>`
      } catch (err) {
        this.logger.error?.(`WireViz rendering error: ${err.message}`)
        return `<pre>WireViz Error: ${mdinst.utils.escapeHtml(err.message)}</pre>`
      }
    }
  },

  renderViaWirevizWebSync(wirevizCode) {
    // Use spawnSync to call curl synchronously and not add a new wikijs dependency
    const curlArgs = [
      '-s', // silent
      '-X', 'POST',
      '-F', `yml_file=@-`, // read from stdin
      '-H', 'Accept: text/html',
      this.wirevizWebUrl.replace(/\/$/, '') + '/render'
    ]

    const res = spawnSync('curl', curlArgs, {
      input: wirevizCode,
      encoding: 'utf8'
    })

    if (res.error) {
      throw new Error(`curl failed: ${res.error.message}`)
    }

    const stdout = res.stdout
    const stderr = res.stderr

    if (stderr) {
      this.logger.warn?.('curl stderr: ' + stderr)
    }

    if (!stdout || !stdout.includes('<svg')) {
      throw new Error(stdout)
    }

    return stdout
  }
}
