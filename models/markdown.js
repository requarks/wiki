"use strict";

var Promise = require('bluebird'),
	md = require('markdown-it'),
	mdEmoji = require('markdown-it-emoji'),
	mdTaskLists = require('markdown-it-task-lists'),
	mdAbbr = require('markdown-it-abbr'),
	mdAnchor = require('markdown-it-toc-and-anchor').default,
	mdFootnote = require('markdown-it-footnote'),
	mdExternalLinks = require('markdown-it-external-links'),
	mdExpandTabs = require('markdown-it-expand-tabs'),
	mdAttrs = require('markdown-it-attrs'),
	hljs = require('highlight.js'),
	slug = require('slug'),
	cheerio = require('cheerio'),
	_ = require('lodash');

// Load plugins

var mkdown = md({
		html: true,
		linkify: true,
		typography: true,
		highlight: function (str, lang) {
			if (lang && hljs.getLanguage(lang)) {
				try {
					return '<pre class="hljs"><code>' + hljs.highlight(lang, str, true).value + '</code></pre>';
				} catch (__) {}
			}
			return '<pre class="hljs"><code>' + hljs.highlightAuto(str).value + '</code></pre>';
		}
	})
	.use(mdEmoji)
	.use(mdTaskLists)
	.use(mdAbbr)
	.use(mdAnchor, {
		tocClassName: 'toc',
		anchorClassName: 'toc-anchor'
	})
	.use(mdFootnote)
	.use(mdExternalLinks, {
		externalClassName: 'external-link',
		internalClassName: 'internal-link'
	})
	.use(mdExpandTabs, {
		tabWidth: 4
	})
	.use(mdAttrs);

// Rendering rules

mkdown.renderer.rules.emoji = function(token, idx) {
  return '<i class="twa twa-' + token[idx].markup + '"></i>';
};

mkdown.inline.ruler.push('internal_link', (state) => {

});

/**
 * Parse markdown content and build TOC tree
 *
 * @param      {(Function|string)}  content  Markdown content
 * @return     {Array}             TOC tree
 */
const parseTree = (content) => {

	let tokens = md().parse(content, {});
	let tocArray = [];

	//-> Extract headings and their respective levels

	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].type !== "heading_close") {
		  continue
		}

		const heading = tokens[i - 1]
		const heading_close = tokens[i]

		if (heading.type === "inline") {
		  let content = "";
		  let anchor = "";
		  if (heading.children && heading.children[0].type === "link_open") {
			 content = heading.children[1].content
			 anchor = slug(content, {lower: true});
		  } else {
			 content = heading.content
			 anchor = slug(heading.children.reduce((acc, t) => acc + t.content, ""), {lower: true});
		  }

		  tocArray.push({
			 content,
			 anchor,
			 level: +heading_close.tag.substr(1, 1)
		  })
		}
	 }

	 //-> Exclude levels deeper than 2

	 _.remove(tocArray, (n) => { return n.level > 2; });

	 //-> Build tree from flat array

	 return _.reduce(tocArray, (tree, v) => {
		let treeLength = tree.length - 1;
		if(v.level < 2) {
			tree.push({
				content: v.content,
				anchor: v.anchor,
				nodes: []
			});
		} else {
			let lastNodeLevel = 1;
			let GetNodePath = (startPos) => {
				lastNodeLevel++;
				if(_.isEmpty(startPos)) {
					startPos = 'nodes';
				}
				if(lastNodeLevel === v.level) {
					return startPos;
				} else {
					return GetNodePath(startPos + '[' + (_.at(tree[treeLength], startPos).length - 1) + '].nodes');
				}
			};
			let lastNodePath = GetNodePath();
			let lastNode = _.get(tree[treeLength], lastNodePath);
			if(lastNode) {
				lastNode.push({
					content: v.content,
					anchor: v.anchor,
					nodes: []
				});
				_.set(tree[treeLength], lastNodePath, lastNode);
			}
		}
		return tree;
	}, []);

};

/**
 * Parse markdown content to HTML
 *
 * @param      {String}    content  Markdown content
 * @return     {String}  HTML formatted content
 */
const parseContent = (content)  => {

	let output = mkdown.render(content);
	let cr = cheerio.load(output);
	cr('table').addClass('table is-bordered is-striped is-narrow');
	output = cr.html();

	return output;

};

module.exports = {

	parse(content) {
		return {
			html: parseContent(content),
			tree: parseTree(content)
		};
	}

};