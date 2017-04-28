'use strict'

var express = require('express')
var router = express.Router()
const Promise = require('bluebird')
const validator = require('validator')
const _ = require('lodash')
const axios = require('axios')
const path = require('path')
const fs = Promise.promisifyAll(require('fs-extra'))

/**
 * Admin
 */
router.get('/', (req, res) => {
  res.redirect('/admin/profile')
})

router.get('/profile', (req, res) => {
  if (res.locals.isGuest) {
    return res.render('error-forbidden')
  }

  res.render('pages/admin/profile', { adminTab: 'profile' })
})

router.post('/profile', (req, res) => {
  if (res.locals.isGuest) {
    return res.render('error-forbidden')
  }

  return db.User.findById(req.user.id).then((usr) => {
    usr.name = _.trim(req.body.name)
    if (usr.provider === 'local' && req.body.password !== '********') {
      let nPwd = _.trim(req.body.password)
      if (nPwd.length < 6) {
        return Promise.reject(new Error('New Password too short!'))
      } else {
        return db.User.hashPassword(nPwd).then((pwd) => {
          usr.password = pwd
          return usr.save()
        })
      }
    } else {
      return usr.save()
    }
  }).then(() => {
    return res.json({ msg: 'OK' })
  }).catch((err) => {
    res.status(400).json({ msg: err.message })
  })
})

router.get('/stats', (req, res) => {
  if (res.locals.isGuest) {
    return res.render('error-forbidden')
  }

  Promise.all([
    db.Entry.count(),
    db.UplFile.count(),
    db.User.count()
  ]).spread((totalEntries, totalUploads, totalUsers) => {
    return res.render('pages/admin/stats', {
      totalEntries, totalUploads, totalUsers, adminTab: 'stats'
    }) || true
  }).catch((err) => {
    throw err
  })
})

router.get('/users', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.render('error-forbidden')
  }

  db.User.find({})
    .select('-password -rights')
    .sort('name email')
    .exec().then((usrs) => {
      res.render('pages/admin/users', { adminTab: 'users', usrs })
    })
})

router.get('/users/:id', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.render('error-forbidden')
  }

  if (!validator.isMongoId(req.params.id)) {
    return res.render('error-forbidden')
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
      }

      res.render('pages/admin/users-edit', { adminTab: 'users', usr, usrOpts })
    })
})

/**
 * Create / Authorize a new user
 */
router.post('/users/create', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.status(401).json({ msg: 'Unauthorized' })
  }

  let nUsr = {
    email: _.toLower(_.trim(req.body.email)),
    provider: _.trim(req.body.provider),
    password: req.body.password,
    name: _.trim(req.body.name)
  }

  if (!validator.isEmail(nUsr.email)) {
    return res.status(400).json({ msg: 'Invalid email address' })
  } else if (!validator.isIn(nUsr.provider, ['local', 'google', 'windowslive', 'facebook', 'github', 'slack'])) {
    return res.status(400).json({ msg: 'Invalid provider' })
  } else if (nUsr.provider === 'local' && !validator.isLength(nUsr.password, { min: 6 })) {
    return res.status(400).json({ msg: 'Password too short or missing' })
  } else if (nUsr.provider === 'local' && !validator.isLength(nUsr.name, { min: 2 })) {
    return res.status(400).json({ msg: 'Name is missing' })
  }

  db.User.findOne({ email: nUsr.email, provider: nUsr.provider }).then(exUsr => {
    if (exUsr) {
      return res.status(400).json({ msg: 'User already exists!' }) || true
    }

    let pwdGen = (nUsr.provider === 'local') ? db.User.hashPassword(nUsr.password) : Promise.resolve(true)
    return pwdGen.then(nPwd => {
      if (nUsr.provider !== 'local') {
        nUsr.password = ''
        nUsr.name = '-- pending --'
      } else {
        nUsr.password = nPwd
      }

      nUsr.rights = [{
        role: 'read',
        path: '/',
        exact: false,
        deny: false
      }]

      return db.User.create(nUsr).then(() => {
        return res.json({ ok: true })
      })
    }).catch(err => {
      winston.warn(err)
      return res.status(500).json({ msg: err })
    })
  }).catch(err => {
    winston.warn(err)
    return res.status(500).json({ msg: err })
  })
})

router.post('/users/:id', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.status(401).json({ msg: 'Unauthorized' })
  }

  if (!validator.isMongoId(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid User ID' })
  }

  return db.User.findById(req.params.id).then((usr) => {
    usr.name = _.trim(req.body.name)
    usr.rights = JSON.parse(req.body.rights)
    if (usr.provider === 'local' && req.body.password !== '********') {
      let nPwd = _.trim(req.body.password)
      if (nPwd.length < 6) {
        return Promise.reject(new Error('New Password too short!'))
      } else {
        return db.User.hashPassword(nPwd).then((pwd) => {
          usr.password = pwd
          return usr.save()
        })
      }
    } else {
      return usr.save()
    }
  }).then(() => {
    return res.json({ msg: 'OK' })
  }).catch((err) => {
    res.status(400).json({ msg: err.message })
  })
})

/**
 * Delete / Deauthorize a user
 */
router.delete('/users/:id', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.status(401).json({ msg: 'Unauthorized' })
  }

  if (!validator.isMongoId(req.params.id)) {
    return res.status(400).json({ msg: 'Invalid User ID' })
  }

  return db.User.findByIdAndRemove(req.params.id).then(() => {
    return res.json({ msg: 'OK' })
  }).catch((err) => {
    res.status(500).json({ msg: err.message })
  })
})

router.get('/settings', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.render('error-forbidden')
  }

  fs.readJsonAsync(path.join(ROOTPATH, 'package.json')).then(packageObj => {
    axios.get('https://api.github.com/repos/Requarks/wiki/releases/latest').then(resp => {
      let sysversion = {
        current: 'v' + packageObj.version,
        latest: resp.data.tag_name,
        latestPublishedAt: resp.data.published_at
      }

      res.render('pages/admin/settings', { adminTab: 'settings', sysversion })
    }).catch(err => {
      winston.warn(err)
      res.render('pages/admin/settings', { adminTab: 'settings', sysversion: { current: 'v' + packageObj.version } })
    })
  })
})

router.post('/settings/install', (req, res) => {
  if (!res.locals.rights.manage) {
    return res.render('error-forbidden')
  }

  // let sysLib = require(path.join(ROOTPATH, 'libs/system.js'))
  // sysLib.install('v1.0-beta.7')
  res.status(400).send('Sorry, Upgrade/Re-Install via the web UI is not yet ready. You must use the npm upgrade method in the meantime.').end()
})

module.exports = router
