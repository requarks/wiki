"use strict";

var express = require('express');
var router = express.Router();

/**
 * Home
 */
router.get('/', (req, res) => {

	var Promise = require('bluebird');
	var fs = Promise.promisifyAll(require("fs"));

	fs.readFileAsync("repo/Storage/Redis.md", "utf8").then(function(contents) {
		let pageData = mark.parse(contents);
		if(!pageData.title) {
			pageData.title = 'Redis';
			pageData.subtitle = 'An open source, in-memory data structure store, used as database, cache and message broker.'
		}
		res.render('pages/view', { pageData });
 	});

});

module.exports = router;