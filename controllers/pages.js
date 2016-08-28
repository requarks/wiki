"use strict";

var express = require('express');
var router = express.Router();
var _ = require('lodash');

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

router.get('/new/*', (req, res, next) => {
	res.send('CREATE MODE');
});

/**
 * Home
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