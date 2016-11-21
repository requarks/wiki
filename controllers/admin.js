"use strict";

var express = require('express');
var router = express.Router();
const Promise = require('bluebird');

/**
 * Admin
 */
router.get('/', (req, res) => {
	res.redirect('/admin/profile');
});

router.get('/profile', (req, res) => {
	res.render('pages/admin/profile', { adminTab: 'profile' });
});

router.get('/stats', (req, res) => {
	Promise.all([
		db.Entry.count(),
		db.UplFile.count(),
		db.User.count()
	]).spread((totalEntries, totalUploads, totalUsers) => {
		return res.render('pages/admin/stats', {
			totalEntries, totalUploads, totalUsers,
			adminTab: 'stats'
		}) || true;
	}).catch((err) => {
		throw err;
	});
});

router.get('/users', (req, res) => {
	res.render('pages/admin/users', { adminTab: 'users' });
});

router.get('/settings', (req, res) => {
	res.render('pages/admin/settings', { adminTab: 'settings' });
});

module.exports = router;