"use strict";

var express = require('express');
var router = express.Router();

router.get('/edit/*', (req, res, next) => {
	res.send('EDIT MODE');
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
		console.log(pageData);
		if(pageData) {
			res.render('pages/view', { pageData });
		} else {
			next();
		}
	}).catch((err) => {
		next();
	});

});

module.exports = router;