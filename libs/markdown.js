"use strict";

var Promise = require('bluebird'),
	md = require('markdown-it'),
	mdEmoji = require('markdown-it-emoji'),
	mdTaskLists = require('markdown-it-task-lists'),
	mdAbbr = require('markdown-it-abbr'),
	mdAnchor = require('markdown-it-anchor'),
	mdFootnote = require('markdown-it-footnote'),
	mdExternalLinks = require('markdown-it-external-links'),
	mdExpandTabs = require('markdown-it-expand-tabs'),
	mdAttrs = require('markdown-it-attrs'),
	hljs = require('highlight.js'),
	cheerio = require('cheerio'),
	_ = require('lodash'),
	mdRemove = require('remove-markdown');

// Load plugins

var mkdown = md({
		html: true,
		linkify: true,
		typography: true,
		highlight(str, lang) {
			if (lang && hljs.getLanguage(lang)) {
				try {
					return '<pre class="hljs"><code>' + hljs.highlight(lang, str, true).value + '</code></pre>';
				} catch (err) {
					return '<pre><code>' + str + '</code></pre>';
				}
			}
			return '<pre><code>' + str + '</code></pre>';
		}
	})
	.use(mdEmoji)
	.use(mdTaskLists)
	.use(mdAbbr)
	.use(mdAnchor, {
		slugify: _.kebabCase,
		permalink: true,
		permalinkClass: 'toc-anchor',
		permalinkSymbol: '#',
		permalinkBefore: true
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
			continue;
		}

		const heading = tokens[i - 1];
		const heading_close = tokens[i];

		if (heading.type === "inline") {
			let content = "";
			let anchor = "";
			if (heading.children && heading.children[0].type === "link_open") {
			 content = heading.children[1].content;
			 anchor = _.kebabCase(content);
			} else {
			 content = heading.content;
			 anchor = _.kebabCase(heading.children.reduce((acc, t) => acc + t.content, ""));
			}

			tocArray.push({
			 content,
			 anchor,
			 level: +heading_close.tag.substr(1, 1)
			});
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

/**
 * Parse meta-data tags from content
 *
 * @param      {String}  content  Markdown content
 * @return     {Object}  Properties found in the content and their values
 */
const parseMeta = (content) => {

	let commentMeta = new RegExp('<!-- ?([a-zA-Z]+):(.*)-->','g');
	let results = {}, match;
	while(match = commentMeta.exec(content)) {
		results[_.toLower(match[1])] = _.trim(match[2]);
	}

	return results;

};

module.exports = {

	/**
	 * Parse content and return all data
	 *
	 * @param      {String}  content  Markdown-formatted content
	 * @return     {Object}  Object containing meta, html and tree data
	 */
	parse(content) {
		return {
			meta: parseMeta(content),
			html: parseContent(content),
			tree: parseTree(content)
		};
	},

	parseContent,
	parseMeta,
	parseTree,

	/**
	 * Strips non-text elements from Markdown content
	 *
	 * @param      {String}  content  Markdown-formatted content
	 * @return     {String}  Text-only version
	 */
	removeMarkdown(content) {
		return mdRemove(_.chain(content)
			.replace(/<!-- ?([a-zA-Z]+):(.*)-->/g, '')
			.replace(/```[^`]+```/g, '')
			.replace(/`[^`]+`/g, '')
			.replace(new RegExp('(?!mailto:)(?:(?:http|https|ftp)://)(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?', 'g'), '')
			.replace(/\r?\n|\r/g, ' ')
			.deburr()
			.toLower()
			.replace(/(\b([^a-z]+)\b)/g, ' ')
			.replace(/[^a-z]+/g, ' ')
			.replace(/(\b(\w{1,2})\b(\W|$))/g, '')
			.replace(/\s\s+/g, ' ')
			.value()
		);
	}

};