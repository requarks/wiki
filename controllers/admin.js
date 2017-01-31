"use strict";

var express = require('express');
var router = express.Router();
const Promise = require('bluebird');
const validator = require('validator');
const _ = require('lodash');

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

router.post('/profile', (req, res) => {

	if(res.locals.isGuest) {
		return res.render('error-forbidden');
	}

	return db.User.findById(req.user.id).then((usr) => {
		usr.name = _.trim(req.body.name);
		if(usr.provider === 'local' && req.body.password !== '********') {
			let nPwd = _.trim(req.body.password);
			if(nPwd.length < 6) {
				return Promise.reject(new Error('New Password too short!'))
			} else {
				return db.User.hashPassword(nPwd).then((pwd) => {
					usr.password = pwd;
					return usr.save();
				});
			}
		} else {
			return usr.save();
		}
	}).then(() => {
		return res.json({ msg: 'OK' });
	}).catch((err) => {
		res.status(400).json({ msg: err.message });
	})

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

router.post('/users/:id', (req, res) => {

	if(!res.locals.rights.manage) {
		return res.status(401).json({ msg: 'Unauthorized' });
	}

	if(!validator.isMongoId(req.params.id)) {
		return res.status(400).json({ msg: 'Invalid User ID' });
	}

	return db.User.findById(req.params.id).then((usr) => {
		usr.name = _.trim(req.body.name);
		usr.rights = JSON.parse(req.body.rights);
		if(usr.provider === 'local' && req.body.password !== '********') {
			let nPwd = _.trim(req.body.password);
			if(nPwd.length < 6) {
				return Promise.reject(new Error('New Password too short!'))
			} else {
				return db.User.hashPassword(nPwd).then((pwd) => {
					usr.password = pwd;
					return usr.save();
				});
			}
		} else {
			return usr.save();
		}
	}).then(() => {
		return res.json({ msg: 'OK' });
	}).catch((err) => {
		res.status(400).json({ msg: err.message });
	})

});

router.get('/settings', (req, res) => {

	if(!res.locals.rights.manage) {
		return res.render('error-forbidden');
	}

	res.render('pages/admin/settings', { adminTab: 'settings' });

});

module.exports = router;