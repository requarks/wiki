const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')
const { pipeline } = require('node:stream/promises')
const { Transform } = require('node:stream')

/* global BigInt */

/**
 * Minimal ZIP writer for the .wkbackup package format.
 *
 * The wkbackup spec constrains the writer so that readers can stay small:
 *  - No data descriptors. CRC32 and both sizes always go in the local header,
 *    and general purpose bit 3 is never set. A deflated entry therefore has to
 *    be compressed before its local header can be written, which is why
 *    addStream() stages the compressed bytes in a temp file first.
 *  - General purpose bit 11 (UTF-8 filenames) is always set.
 *  - ZIP64 whenever an entry, the archive, or the entry count requires it.
 *  - Entry order is preserved exactly as added; it is part of the format.
 *  - Compression method is chosen per entry: deflate for text, store for
 *    anything already compressed.
 */

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const EOCD_SIG = 0x06054b50
const ZIP64_EOCD_SIG = 0x06064b50
const ZIP64_LOCATOR_SIG = 0x07064b50

const ZIP64_LIMIT = 0xfffffffe
const ZIP64_COUNT_LIMIT = 0xfffe

const METHOD_STORE = 0
const METHOD_DEFLATE = 8

const FLAG_UTF8 = 0x0800

const VERSION_BASE = 20
const VERSION_ZIP64 = 45

// Version made by: UNIX (3) in the upper byte, spec version in the lower.
const VERSION_MADE_BY = (3 << 8) | VERSION_ZIP64

const crcTable = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  return table
})()

/**
 * Incremental CRC32, matching the polynomial ZIP uses.
 */
class CRC32 {
  constructor () {
    this.crc = -1
  }

  update (buf) {
    let crc = this.crc
    for (let i = 0; i < buf.length; i++) {
      crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
    }
    this.crc = crc
    return this
  }

  get value () {
    return (this.crc ^ -1) >>> 0
  }
}

function crc32 (buf) {
  return new CRC32().update(buf).value
}

/**
 * MS-DOS date / time pair, as stored in ZIP headers.
 */
function dosDateTime (date) {
  const year = date.getFullYear()
  if (year < 1980) {
    return { date: 0x21, time: 0 }
  }
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  }
}

class ZipWriter {
  /**
   * @param {string} outputPath Path of the archive to create.
   * @param {Object} opts
   * @param {string} opts.tmpPath Directory used to stage compressed entries.
   */
  constructor (outputPath, { tmpPath }) {
    this.outputPath = outputPath
    this.tmpPath = tmpPath
    this.entries = []
    this.offset = 0
    this.stream = null
    this.tmpSeq = 0
  }

  async open () {
    await fs.ensureDir(path.dirname(this.outputPath))
    await fs.ensureDir(this.tmpPath)
    this.stream = fs.createWriteStream(this.outputPath)
    await new Promise((resolve, reject) => {
      this.stream.once('open', resolve)
      this.stream.once('error', reject)
    })
  }

  /**
   * Write raw bytes to the archive, honouring backpressure.
   */
  async _write (buf) {
    if (!this.stream.write(buf)) {
      await new Promise((resolve, reject) => {
        const onDrain = () => {
          this.stream.removeListener('error', onError)
          resolve()
        }
        const onError = (err) => {
          this.stream.removeListener('drain', onDrain)
          reject(err)
        }
        this.stream.once('drain', onDrain)
        this.stream.once('error', onError)
      })
    }
    this.offset += buf.length
  }

  /**
   * Add an entry whose CRC32 and both sizes are already known, writing the
   * local header followed by `writeBody()`.
   */
  async _addEntry (name, { method, crc, compressedSize, uncompressedSize, modifiedAt }, writeBody) {
    const nameBuf = Buffer.from(name, 'utf8')
    const needsZip64 = compressedSize > ZIP64_LIMIT || uncompressedSize > ZIP64_LIMIT
    const { date, time } = dosDateTime(modifiedAt || new Date())

    // -> Local file header
    const extraLen = needsZip64 ? 20 : 0
    const header = Buffer.alloc(30 + extraLen)
    header.writeUInt32LE(LOCAL_SIG, 0)
    header.writeUInt16LE(needsZip64 ? VERSION_ZIP64 : VERSION_BASE, 4)
    header.writeUInt16LE(FLAG_UTF8, 6)
    header.writeUInt16LE(method, 8)
    header.writeUInt16LE(time, 10)
    header.writeUInt16LE(date, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(needsZip64 ? 0xffffffff : compressedSize, 18)
    header.writeUInt32LE(needsZip64 ? 0xffffffff : uncompressedSize, 22)
    header.writeUInt16LE(nameBuf.length, 26)
    header.writeUInt16LE(extraLen, 28)
    if (needsZip64) {
      // Both sizes are mandatory in a local header's ZIP64 extra field.
      header.writeUInt16LE(0x0001, 30)
      header.writeUInt16LE(16, 32)
      header.writeBigUInt64LE(BigInt(uncompressedSize), 34)
      header.writeBigUInt64LE(BigInt(compressedSize), 42)
    }

    const localHeaderOffset = this.offset
    await this._write(header)
    await this._write(nameBuf)
    await writeBody()

    this.entries.push({
      nameBuf,
      method,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      date,
      time,
      needsZip64
    })
  }

  /**
   * Add an entry from a buffer already held in memory. Used for the manifest,
   * the small JSON streams and for blobs, whose bytes come out of the database
   * as a single buffer anyway.
   *
   * @param {string} name Entry path within the archive.
   * @param {Buffer} buf Uncompressed contents.
   * @param {Object} opts
   * @param {boolean} opts.compress Deflate the entry (false stores it as-is).
   */
  async addBuffer (name, buf, { compress = true, modifiedAt } = {}) {
    const uncompressedSize = buf.length
    const crc = crc32(buf)
    let method = METHOD_STORE
    let body = buf

    if (compress && uncompressedSize > 0) {
      const deflated = await new Promise((resolve, reject) => {
        zlib.deflateRaw(buf, (err, result) => err ? reject(err) : resolve(result))
      })
      // Storing is better than a deflate that made the entry bigger.
      if (deflated.length < uncompressedSize) {
        method = METHOD_DEFLATE
        body = deflated
      }
    }

    await this._addEntry(name, {
      method,
      crc,
      compressedSize: body.length,
      uncompressedSize,
      modifiedAt
    }, () => this._write(body))
  }

  /**
   * Add an entry produced by a stream of unknown length.
   *
   * Because the local header may not be followed by a data descriptor, the
   * contents are staged to a temp file first: that pass computes the CRC32 and
   * both sizes, and the staged bytes are then copied into the archive.
   *
   * @param {string} name Entry path within the archive.
   * @param {Readable} source Stream of uncompressed bytes.
   * @param {Object} opts
   * @param {boolean} opts.compress Deflate the entry (false stores it as-is).
   */
  async addStream (name, source, { compress = true, modifiedAt } = {}) {
    const stagePath = path.join(this.tmpPath, `entry-${this.tmpSeq++}.part`)
    const hasher = new CRC32()
    let uncompressedSize = 0

    const counter = new Transform({
      transform (chunk, enc, cb) {
        hasher.update(chunk)
        uncompressedSize += chunk.length
        cb(null, chunk)
      }
    })

    try {
      const stages = [source, counter]
      if (compress) {
        stages.push(zlib.createDeflateRaw())
      }
      stages.push(fs.createWriteStream(stagePath))
      await pipeline(...stages)

      const { size: compressedSize } = await fs.stat(stagePath)

      await this._addEntry(name, {
        method: compress ? METHOD_DEFLATE : METHOD_STORE,
        crc: hasher.value,
        compressedSize,
        uncompressedSize,
        modifiedAt
      }, async () => {
        for await (const chunk of fs.createReadStream(stagePath)) {
          await this._write(chunk)
        }
      })

      return { uncompressedSize, compressedSize }
    } finally {
      await fs.remove(stagePath)
    }
  }

  /**
   * Write the central directory and close the archive.
   */
  async close () {
    const centralOffset = this.offset

    for (const entry of this.entries) {
      const zip64Fields = []
      if (entry.uncompressedSize > ZIP64_LIMIT) { zip64Fields.push(entry.uncompressedSize) }
      if (entry.compressedSize > ZIP64_LIMIT) { zip64Fields.push(entry.compressedSize) }
      if (entry.localHeaderOffset > ZIP64_LIMIT) { zip64Fields.push(entry.localHeaderOffset) }

      // The ZIP64 extra field carries only the fields that overflowed, in the
      // fixed order: uncompressed size, compressed size, local header offset.
      const extraLen = zip64Fields.length > 0 ? 4 + (zip64Fields.length * 8) : 0
      const header = Buffer.alloc(46 + extraLen)
      header.writeUInt32LE(CENTRAL_SIG, 0)
      header.writeUInt16LE(VERSION_MADE_BY, 4)
      header.writeUInt16LE(extraLen > 0 ? VERSION_ZIP64 : VERSION_BASE, 6)
      header.writeUInt16LE(FLAG_UTF8, 8)
      header.writeUInt16LE(entry.method, 10)
      header.writeUInt16LE(entry.time, 12)
      header.writeUInt16LE(entry.date, 14)
      header.writeUInt32LE(entry.crc, 16)
      header.writeUInt32LE(entry.compressedSize > ZIP64_LIMIT ? 0xffffffff : entry.compressedSize, 20)
      header.writeUInt32LE(entry.uncompressedSize > ZIP64_LIMIT ? 0xffffffff : entry.uncompressedSize, 24)
      header.writeUInt16LE(entry.nameBuf.length, 28)
      header.writeUInt16LE(extraLen, 30)
      header.writeUInt16LE(0, 32) // file comment length
      header.writeUInt16LE(0, 34) // disk number start
      header.writeUInt16LE(0, 36) // internal attributes
      header.writeUInt32LE(0o644 << 16, 38) // external attributes
      header.writeUInt32LE(entry.localHeaderOffset > ZIP64_LIMIT ? 0xffffffff : entry.localHeaderOffset, 42)
      if (extraLen > 0) {
        header.writeUInt16LE(0x0001, 46)
        header.writeUInt16LE(zip64Fields.length * 8, 48)
        zip64Fields.forEach((value, idx) => {
          header.writeBigUInt64LE(BigInt(value), 50 + (idx * 8))
        })
      }

      await this._write(header)
      await this._write(entry.nameBuf)
    }

    const centralSize = this.offset - centralOffset
    const entryCount = this.entries.length
    const needsZip64 = entryCount > ZIP64_COUNT_LIMIT ||
      centralSize > ZIP64_LIMIT ||
      centralOffset > ZIP64_LIMIT

    if (needsZip64) {
      const zip64Offset = this.offset

      const record = Buffer.alloc(56)
      record.writeUInt32LE(ZIP64_EOCD_SIG, 0)
      record.writeBigUInt64LE(BigInt(44), 4) // size of this record, minus 12
      record.writeUInt16LE(VERSION_MADE_BY, 12)
      record.writeUInt16LE(VERSION_ZIP64, 14)
      record.writeUInt32LE(0, 16) // this disk
      record.writeUInt32LE(0, 20) // disk with start of central directory
      record.writeBigUInt64LE(BigInt(entryCount), 24)
      record.writeBigUInt64LE(BigInt(entryCount), 32)
      record.writeBigUInt64LE(BigInt(centralSize), 40)
      record.writeBigUInt64LE(BigInt(centralOffset), 48)
      await this._write(record)

      const locator = Buffer.alloc(20)
      locator.writeUInt32LE(ZIP64_LOCATOR_SIG, 0)
      locator.writeUInt32LE(0, 4) // disk with the ZIP64 end of central directory
      locator.writeBigUInt64LE(BigInt(zip64Offset), 8)
      locator.writeUInt32LE(1, 16) // total number of disks
      await this._write(locator)
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(EOCD_SIG, 0)
    eocd.writeUInt16LE(0, 4) // this disk
    eocd.writeUInt16LE(0, 6) // disk with start of central directory
    eocd.writeUInt16LE(entryCount > ZIP64_COUNT_LIMIT ? 0xffff : entryCount, 8)
    eocd.writeUInt16LE(entryCount > ZIP64_COUNT_LIMIT ? 0xffff : entryCount, 10)
    eocd.writeUInt32LE(centralSize > ZIP64_LIMIT ? 0xffffffff : centralSize, 12)
    eocd.writeUInt32LE(centralOffset > ZIP64_LIMIT ? 0xffffffff : centralOffset, 16)
    eocd.writeUInt16LE(0, 20) // archive comment length
    await this._write(eocd)

    await new Promise((resolve, reject) => {
      this.stream.once('error', reject)
      this.stream.end(resolve)
    })
    this.stream = null
  }

  /**
   * Abort the archive, discarding whatever was written so far.
   */
  async abort () {
    if (this.stream) {
      await new Promise(resolve => this.stream.end(resolve))
      this.stream = null
    }
    await fs.remove(this.outputPath)
  }
}

module.exports = {
  ZipWriter,
  CRC32,
  crc32
}
