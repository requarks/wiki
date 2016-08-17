"use strict";

var modb = require('mongoose');
var bcrypt = require('bcryptjs-then');
var Promise = require('bluebird');
var _ = require('lodash');

/**
 * User Schema
 *
 * @type       {Object}
 */
var userSchema = modb.Schema({

  email: {
    type: String,
    required: true,
    index: true,
    minlength: 6
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    minlength: 1
  },
  lastName: {
    type: String,
    required: true,
    minlength: 1
  },
  timezone: {
    type: String,
    required: true,
    default: 'UTC'
  },
  lang: {
    type: String,
    required: true,
    default: 'en'
  },
  rights: [{
    type: String,
    required: true
  }]

},
{
  timestamps: {}
});

/**
 * VIRTUAL - Full Name
 */
userSchema.virtual('fullName').get(function() {
  return this.firstName + ' ' + this.lastName;
});

/**
 * INSTANCE - Validate password against hash
 *
 * @param      {string}   uPassword  The user password
 * @return     {Promise<Boolean>}  Promise with valid / invalid boolean
 */
userSchema.methods.validatePassword = function(uPassword) {
  let self = this;
  return bcrypt.compare(uPassword, self.password);
};

/**
 * MODEL - Generate hash from password
 *
 * @param      {string}   uPassword  The user password
 * @return     {Promise<String>}  Promise with generated hash
 */
userSchema.statics.generateHash = function(uPassword) {
    return bcrypt.hash(uPassword, 10);
};

/**
 * MODEL - Create a new user
 *
 * @param      {Object}   nUserData  User data
 * @return     {Promise}  Promise of the create operation
 */
userSchema.statics.new = function(nUserData) {

  let self = this;

  return self.generateHash(nUserData.password).then((passhash) => {
    return this.create({
      _id: db.ObjectId(),
      email: nUserData.email,
      firstName: nUserData.firstName,
      lastName: nUserData.lastName,
      password: passhash,
      rights: ['admin']
    });
  });
  
};

/**
 * MODEL - Edit a user
 *
 * @param      {String}   userId  The user identifier
 * @param      {Object}   data    The user data
 * @return     {Promise}  Promise of the update operation
 */
userSchema.statics.edit = function(userId, data) {

  let self = this;

  // Change basic info

  let fdata = {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    timezone: data.timezone,
    lang: data.lang,
    rights: data.rights
  };
  let waitTask = null;

  // Change password?

  if(!_.isEmpty(data.password) && _.trim(data.password) !== '********') {
    waitTask = self.generateHash(data.password).then((passhash) => {
      fdata.password = passhash;
      return fdata;
    });
  } else {
    waitTask = Promise.resolve(fdata);
  }

  // Update user

  return waitTask.then((udata) => {
    return this.findByIdAndUpdate(userId, udata, { runValidators: true });
  });

};

/**
 * MODEL - Delete a user
 *
 * @param      {String}   userId  The user ID
 * @return     {Promise}  Promise of the delete operation
 */
userSchema.statics.erase = function(userId) {
  return this.findByIdAndRemove(userId);
};

module.exports = modb.model('User', userSchema);