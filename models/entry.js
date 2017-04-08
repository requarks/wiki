'use strict'

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
  parentPath: {
    type: String,
    default: ''
  }

},
  {
    timestamps: {}
  })

module.exports = Mongoose.model('Entry', entrySchema)
