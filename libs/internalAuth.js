"use strict";

const crypto = require('crypto');

/**
 * Internal Authentication
 */
module.exports = {

	_curKey: false,

	init(inKey) {

		this._curKey = inKey;

		return this;

	},

	generateKey() {

		return crypto.randomBytes(20).toString('hex')

	},

	validateKey(inKey) {

		return inKey === this._curKey;

	}

};