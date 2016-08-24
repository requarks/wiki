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
		if(!pageData.meta.title) {
			pageData.meta.title = 'Redis.md';
		}
		res.render('pages/view', { pageData });
 	});

});

module.exports = router;