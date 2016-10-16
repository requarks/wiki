"use strict";

const modb = require('mongoose'),
			Promise = require('bluebird'),
			_ = require('lodash');

/**
 * Upload Folder schema
 *
 * @type       {<Mongoose.Schema>}
 */
var uplFolderSchema = modb.Schema({

	_id: String,

  name: {
    type: String,
    index: true
  }

},
{
	timestamps: {}
});

module.exports = modb.model('UplFolder', uplFolderSchema);