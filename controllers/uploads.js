"use strict";

var express = require('express');
var router = express.Router();
var _ = require('lodash');

var validPathRe = new RegExp("^([a-z0-9\\/-]+\\.[a-z0-9]+)$");

// ==========================================
// SERVE UPLOADS FILES
// ==========================================

router.get('/*', (req, res, next) => {

	let fileName = req.params[0];
	if(!validPathRe.test(fileName)) {
		return res.sendStatus(404).end();
	}

	//todo: Authentication-based access

	res.sendFile(fileName, {
		root: git.getRepoPath() + '/uploads/',
		dotfiles: 'deny'
	}, (err) => {
		if (err) {
			res.status(err.status).end();
		}
	});

});

module.exports = router;