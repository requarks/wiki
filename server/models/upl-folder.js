'use strict'

const Mongoose = require('mongoose')

/**
 * Upload Folder schema
 *
 * @type       {<Mongoose.Schema>}
 */
var uplFolderSchema = Mongoose.Schema({

  _id: String,

  name: {
    type: String,
    index: true
  }

}, { timestamps: {} })

module.exports = Mongoose.model('UplFolder', uplFolderSchema)
