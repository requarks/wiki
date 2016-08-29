"use strict";

var express = require('express');
var router = express.Router();
var _ = require('lodash');

// ==========================================
// EDIT MODE
// ==========================================

/**
 * Edit document in Markdown
 */
router.get('/edit/*', (req, res, next) => {

	let safePath = entries.parsePath(_.replace(req.path, '/edit', ''));

	entries.fetchOriginal(safePath, {
		parseMarkdown: false,
		parseMeta: true,
		parseTree: false,
		includeMarkdown: true,
		includeParentInfo: false,
		cache: false
	}).then((pageData) => {
		if(pageData) {
			return res.render('pages/edit', { pageData });
		} else {
			throw new Error('Invalid page path.');
		}
	}).catch((err) => {
		res.render('error', {
			message: err.message,
			error: {}
		});
	});

});

router.put('/edit/*', (req, res, next) => {

	let safePath = entries.parsePath(_.replace(req.path, '/edit', ''));

	entries.update(safePath, req.body.markdown).then(() => {
		res.json({
			ok: true
		});
	}).catch((err) => {
		res.json({
			ok: false,
			error: err.message
		});
	});

});

// ==========================================
// CREATE MODE
// ==========================================

router.get('/new/*', (req, res, next) => {
	res.send('CREATE MODE');
});

// ==========================================
// VIEW MODE
// ==========================================

/**
 * View document
 */
router.get('/*', (req, res, next) => {

	let safePath = entries.parsePath(req.path);

	entries.fetch(safePath).then((pageData) => {
		if(pageData) {
			return res.render('pages/view', { pageData });
		} else {
			return next();
		}
	}).catch((err) => {
		winston.error(err);
		next();
	});

});

module.exports = router;