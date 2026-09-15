/*
  Addressed through the package's own `exports` map, which is `"./*": "./esm/vs/*.js"` — so the path
  inside it is what goes here and `monaco-editor/esm/vs/...` doubles the prefix into a file that does
  not exist. That is not a detail: it is the reason this module could never have run. It was written
  with the deeper specifiers, nothing imported it, and an import nobody makes is never resolved — so
  the build stayed green while the app went without workers entirely.
*/
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker?worker'

/**
 * Where Monaco gets its web workers.
 *
 * Monaco does the expensive half of its work off the main thread — tokenizing, diffing, and every
 * language service behind completion, validation and formatting — and it has to be told how to make
 * one. `MonacoEnvironment.getWorker` is that: `standaloneWebWorkerService` asks for it first and only
 * falls back to working the location out for itself when it is absent.
 *
 * That fallback cannot work here. It resolves `editorWebWorkerMain.js` against the `import.meta.url`
 * of Monaco's own bundled chunk, which after a build is a path nothing was emitted at, and the module
 * that does load fails on the first relative import inside it —
 * `Failed to resolve module specifier "../../../base/common/worker/webWorkerBootstrap.js"`. Every
 * editor in the app raised it on open, and went without everything the workers provide.
 *
 * Each worker is a Vite `?worker` entry, so it is emitted as a script of its own and imported here as
 * a constructor. None of them is fetched until one is constructed, which is the first time an editor
 * is opened — so this costs a boot nothing on the pages that never open one.
 */
export function initializeMonaco() {
  self.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') {
        return new JsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new CssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new HtmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new TsWorker()
      }
      return new EditorWorker()
    }
  }
}
