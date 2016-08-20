"use strict";

var express = require('express');
var router = express.Router();

/**
 * Home
 */
router.get('/', (req, res) => {

	var md = require('markdown-it')({
		breaks: true,
	  linkify: true,
	  typographer: true
	});

	var Promise = require('bluebird');
	var fs = Promise.promisifyAll(require("fs"));
	fs.readFileAsync("repo/Gollum.md", "utf8").then(function(contents) {
    res.render('pages/view', { contents: md.render(contents) });
 	});

});

module.exports = router;