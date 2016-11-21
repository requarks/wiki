"use strict";

const Promise = require('bluebird'),
			_ = require('lodash');

/**
 * Entry schema
 *
 * @type       {<Mongoose.Schema>}
 */
var entrySchema = Mongoose.Schema({

	_id: String,

  title: {
    type: String,
    required: true,
    minlength: 2
  },
  subtitle: {
    type: String,
    default: ''
  },
  parent: {
    type: String,
    default: ''
  },
  content: {
    type: String,
    default: ''
  }

},
{
	timestamps: {}
});

entrySchema.index({
  _id: 'text',
  title: 'text',
  subtitle: 'text',
  content: 'text'
}, {
  weights: {
    _id: 3,
    title: 10,
    subtitle: 5,
    content: 1
  },
  name: 'EntriesTextIndex'
});

module.exports = Mongoose.model('Entry', entrySchema);