"use strict";

const modb = require('mongoose'),
			Promise = require('bluebird'),
			_ = require('lodash');

/**
 * Region schema
 *
 * @type       {<Mongoose.Schema>}
 */
var userSchema = modb.Schema({

	email: {
		type: String,
		required: true
	}

},
{
	timestamps: {}
});

module.exports = modb.model('User', userSchema);