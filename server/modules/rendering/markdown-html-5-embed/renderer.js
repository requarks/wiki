const mdHtml5 = require('markdown-it-html5-embed');

// ------------------------------------
// Markdown - HTML5 Audio/Video
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdHtml5, {
      html5embed: {
        useImageSyntax: conf.useImageSyntax, // Enables video/audio embed with ![]() syntax (default)
        useLinkSyntax: conf.useLinkSyntax // Enables video/audio embed with []() syntax
      }
    })
  }
};
