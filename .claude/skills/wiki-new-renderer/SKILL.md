---
name: wiki-new-renderer
description: Use when adding a new markdown rendering module or custom syntax renderer to this Wiki.js fork
---

# Adding a Rendering Module

Rendering modules live in `server/modules/rendering/`. Each is a directory with a `definition.yml` and an `index.js`.

## Steps

### 1. Create module directory
```
server/modules/rendering/<your-module-name>/
  definition.yml
  index.js
```

### 2. `definition.yml` — module metadata
Copy from existing module (e.g. `server/modules/rendering/markdown-core/definition.yml`). Key fields:
```yaml
key: your-module-name
title: Your Module Title
description: What it does
author: Your Name
input: markdown       # or html
output: html
icon: mdi-language-markdown
enabledDefault: false
props: {}             # configurable options; empty if none
```

### 3. `index.js` — renderer logic
```js
module.exports = {
  async render ({ input }) {
    // transform input string, return html string
    return transformedHtml
  }
}
```
- `input` is a string (markdown or html depending on `definition.yml`)
- Must return a string
- Async OK — can call external libs

### 4. Register (auto-discovery)
Wiki.js uses `auto-load` — no manual registration needed. Module loads on server restart.

### 5. Test
```bash
# Run jest tests for rendering helpers
yarn test
```
Integration: enable module in Admin → Rendering pipeline and verify output in a wiki page.

## Custom Couchbase Renderer Pattern

The topology renderer (`@couchbaselabs/topology-ui`) wraps a fenced code block parser. See `server/modules/rendering/markdown-couchbase-topology/` for the established pattern if adding similar diagram renderers.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Module not appearing in Admin UI | Check `definition.yml` syntax — YAML parse error silently skips module |
| `input`/`output` mismatch | Pipeline order matters — renderer must receive correct type |
| Mutating `input` string | Return new string, don't modify in place |
