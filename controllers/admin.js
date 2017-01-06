"use strict";

var express = require('express');
var router = express.Router();
const Promise = require('bluebird');
const validator = require('validator');

/**
 * Admin
 */
router.get('/', (req, res) => {
	res.redirect('/admin/profile');
});

router.get('/profile', (req, res) => {

	if(res.locals.isGuest) {
		return res.render('error-forbidden');
	}

	res.render('pages/admin/profile', { adminTab: 'profile' });

});

router.get('/stats', (req, res) => {

	if(res.locals.isGuest) {
		return res.render('error-forbidden');
	}

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

	if(!res.locals.rights.manage) {
		return res.render('error-forbidden');
	}

	db.User.find({})
		.select('-password -rights')
		.sort('name email')
		.exec().then((usrs) => {
			res.render('pages/admin/users', { adminTab: 'users', usrs });
		});

});

router.get('/users/:id', (req, res) => {

	if(!res.locals.rights.manage) {
		return res.render('error-forbidden');
	}

	if(!validator.isMongoId(req.params.id)) {
		return res.render('error-forbidden');
	}

	db.User.findById(req.params.id)
		.select('-password -providerId')
		.exec().then((usr) => {

			let usrOpts = {
				canChangeEmail: (usr.email !== 'guest' && usr.provider === 'local' && usr.email !== req.app.locals.appconfig.admin),
				canChangeName: (usr.email !== 'guest'),
				canChangePassword: (usr.email !== 'guest' && usr.provider === 'local'),
				canChangeRole: (usr.email !== 'guest' && !(usr.provider === 'local' && usr.email === req.app.locals.appconfig.admin)),
				canBeDeleted: (usr.email !== 'guest' && !(usr.provider === 'local' && usr.email === req.app.locals.appconfig.admin))
			};

			res.render('pages/admin/users-edit', { adminTab: 'users', usr, usrOpts });
		});

});

router.get('/settings', (req, res) => {

	if(!res.locals.rights.manage) {
		return res.render('error-forbidden');
	}

	res.render('pages/admin/settings', { adminTab: 'settings' });

});

module.exports = router;