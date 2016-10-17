"use strict";

const modb = require('mongoose');

/**
 * BruteForce schema
 *
 * @type       {<Mongoose.Schema>}
 */
var bruteForceSchema = modb.Schema({
	_id: { type: String, index: 1 },
	data: {
		count: Number,
		lastRequest: Date,
		firstRequest: Date
	},
	expires: { type: Date, index: { expires: '1d' } }
});

module.exports = modb.model('Bruteforce', bruteForceSchema);