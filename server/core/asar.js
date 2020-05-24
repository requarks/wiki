const pickle = require('chromium-pickle-js')
const path = require('path')
const UINT64 = require('cuint').UINT64
const fs = require('fs')

/* global WIKI */

/**
 * Based of express-serve-asar (https://github.com/toyobayashi/express-serve-asar)
 * by Fenglin Li (https://github.com/toyobayashi)
 */

const packages = {
  'twemoji': path.join(WIKI.ROOTPATH, `assets/svg/twemoji.asar`)
}

module.exports = {
  fdCache: {},
  async serve (pkgName, req, res, next) {
    const file = this.readFilesystemSync(packages[pkgName])
    const { filesystem, fd } = file
    const info = filesystem.getFile(req.path.substring(1))
    if (info) {
      res.set({
        'Content-Type': 'image/svg+xml',
        'Content-Length': info.size
      })

      fs.createReadStream('', {
        fd,
        autoClose: false,
        start: 8 + filesystem.headerSize + parseInt(info.offset, 10),
        end: 8 + filesystem.headerSize + parseInt(info.offset, 10) + info.size - 1
      }).on('error', (err) => {
        WIKI.logger.warn(err)
        res.sendStatus(404)
      }).pipe(res.status(200))
    } else {
      res.sendStatus(404)
    }
  },
  async unload () {
    if (this.fdCache) {
      WIKI.logger.info('Closing ASAR file descriptors...')
      for (const fdItem in this.fdCache) {
        fs.closeSync(this.fdCache[fdItem].fd)
      }
      this.fdCache = {}
    }
  },
  readArchiveHeaderSync (fd) {
    let size
    let headerBuf

    const sizeBuf = Buffer.alloc(8)
    if (fs.readSync(fd, sizeBuf, 0, 8, null) !== 8) {
      throw new Error('Unable to read header size')
    }

    const sizePickle = pickle.createFromBuffer(sizeBuf)
    size = sizePickle.createIterator().readUInt32()
    headerBuf = Buffer.alloc(size)
    if (fs.readSync(fd, headerBuf, 0, size, null) !== size) {
      throw new Error('Unable to read header')
    }

    const headerPickle = pickle.createFromBuffer(headerBuf)
    const header = headerPickle.createIterator().readString()
    return { header: JSON.parse(header), headerSize: size }
  },
  readFilesystemSync (archive) {
    if (!this.fdCache[archive]) {
      const fd = fs.openSync(archive, 'r')
      const header = this.readArchiveHeaderSync(fd)
      const filesystem = new Filesystem(archive)
      filesystem.header = header.header
      filesystem.headerSize = header.headerSize
      this.fdCache[archive] = {
        fd,
        filesystem: filesystem
      }
    }

    return this.fdCache[archive]
  }
}

class Filesystem {
  constructor (src) {
    this.src = path.resolve(src)
    this.header = { files: {} }
    this.offset = UINT64(0)
  }

  searchNodeFromDirectory (p) {
    let json = this.header
    const dirs = p.split(path.sep)
    for (const dir of dirs) {
      if (dir !== '.') {
        json = json.files[dir]
      }
    }
    return json
  }

  getNode (p) {
    const node = this.searchNodeFromDirectory(path.dirname(p))
    const name = path.basename(p)
    if (name) {
      return node.files[name]
    } else {
      return node
    }
  }

  getFile (p, followLinks) {
    followLinks = typeof followLinks === 'undefined' ? true : followLinks
    const info = this.getNode(p)

    if (!info) {
      return false
    }

    if (info.link && followLinks) {
      return this.getFile(info.link)
    } else {
      return info
    }
  }
}
