"use strict";

var express = require('express');
var router = express.Router();

/**
 * Admin
 */
router.get('/', (req, res) => {
	res.send('OK');
});

module.exports = router;