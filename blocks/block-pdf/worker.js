/*
  The pdf.js parser, as its own bundle.

  Everything a PDF costs -- reading the file structure, decoding its images, laying out its glyph
  runs -- happens here rather than on the page's thread, which is the whole reason a viewer stays
  responsive while a hundred-page document loads. It is a separate entry point because a worker is
  loaded by URL, not imported: `component.js` points `GlobalWorkerOptions.workerSrc` at whatever
  this file compiles to, next to it in /_blocks.

  The rollup config picks this up from the file name alone -- any `worker.js` beside a block's
  component becomes `<block>.worker.js` -- so there is nothing to add there for the next block that
  needs one.
*/
export * from 'pdfjs-dist/build/pdf.worker.mjs'
