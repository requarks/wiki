"use strict";

const _ = require('lodash');

/**
 * Rights 
 */
module.exports = {


	check(req, role) {

		let rt = [];
		let p = _.chain(req.originalUrl).toLower().trim().value();

		// Load User Rights

		if(_.isArray(req.user.rights)) {
			rt = req.user.rights;
		}

		// Is admin?

		if(_.find(rt, { role: 'admin' })) {
			return true;
		}

		// Check specific role on path

		let filteredRights = _.filter(rt, (r) => {
			if(r.role === role || (r.role === 'write' && role === 'read')) {
				if((!r.exact && _.startsWith(p, r.path)) || (r.exact && p === r.path)) {
					return true;
				}
			}
			return false;
		});

		// Check for deny scenario

		let isValid = false;

		if(filteredRights.length > 1) {
			isValid = !_.chain(filteredRights).sortBy((r) => {
				return r.path.length + ((r.deny) ? 0.5 : 0);
			}).last().get('deny').value();
		} else if(filteredRights.length == 1 && filteredRights[0].deny === false) {
			isValid = true;
		}

		// Deny by default

		return isValid;

	}

};