"use strict";

var express = require('express');
var router = express.Router();

/**
 * Admin
 */
router.get('/', (req, res) => {
	res.redirect('/admin/profile');
});

router.get('/profile', (req, res) => {
	res.render('pages/account.pug');
});

module.exports = router;