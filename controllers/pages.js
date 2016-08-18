"use strict";

var express = require('express');
var router = express.Router();

/**
 * Home
 */
router.get('/', (req, res) => {
	res.render('pages/view');
});

module.exports = router;