const mockFile = {
  save: jest.fn().mockResolvedValue(),
  delete: jest.fn().mockResolvedValue(),
  move: jest.fn().mockResolvedValue(),
  makePublic: jest.fn().mockResolvedValue()
}

const mockBucketExists = jest.fn().mockResolvedValue([true])

const mockBucket = {
  exists: mockBucketExists,
  file: jest.fn(() => mockFile)
}

const mockStorageInstance = {
  bucket: jest.fn(() => mockBucket)
}

const MockStorage = jest.fn(() => mockStorageInstance)

jest.mock('@google-cloud/storage', () => ({
  Storage: MockStorage
}))

jest.mock('../../../../helpers/page.js', () => ({
  getFileExtension: jest.fn(() => 'md')
}))

const gcsStorage = require('../../../../modules/storage/gcs/storage')

const validServiceAccountKey = JSON.stringify({
  project_id: 'from-key-project',
  client_email: 'test@from-key-project.iam.gserviceaccount.com'
})

const makeContext = (config) => Object.assign(Object.create(gcsStorage), { config })

describe('modules/storage/gcs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockBucketExists.mockResolvedValue([true])
    global.WIKI = {
      logger: {
        info: jest.fn(),
        warn: jest.fn()
      },
      config: {
        lang: {
          namespacing: false,
          code: 'en'
        }
      }
    }
  })

  describe('init', () => {
    it('throws when the service account key is not valid JSON', async () => {
      const ctx = makeContext({
        bucket: 'my-bucket',
        projectId: 'my-project',
        serviceAccountKey: 'not-json'
      })

      await expect(ctx.init()).rejects.toThrow('Invalid Service Account Key: must be valid JSON.')
    })

    it('creates the Storage client using the explicit projectId when provided', async () => {
      const ctx = makeContext({
        bucket: 'my-bucket',
        projectId: 'explicit-project',
        serviceAccountKey: validServiceAccountKey
      })

      await ctx.init()

      expect(MockStorage).toHaveBeenCalledWith({
        projectId: 'explicit-project',
        credentials: JSON.parse(validServiceAccountKey)
      })
    })

    it('falls back to the project_id from the key when projectId is not provided', async () => {
      const ctx = makeContext({
        bucket: 'my-bucket',
        projectId: '',
        serviceAccountKey: validServiceAccountKey
      })

      await ctx.init()

      expect(MockStorage).toHaveBeenCalledWith({
        projectId: 'from-key-project',
        credentials: JSON.parse(validServiceAccountKey)
      })
    })

    it('throws when the bucket does not exist or is not accessible', async () => {
      mockBucketExists.mockResolvedValue([false])
      const ctx = makeContext({
        bucket: 'missing-bucket',
        projectId: 'my-project',
        serviceAccountKey: validServiceAccountKey
      })

      await expect(ctx.init()).rejects.toThrow(
        'Bucket missing-bucket does not exist or is not accessible with the provided credentials.'
      )
    })

    it('completes successfully when the bucket exists', async () => {
      const ctx = makeContext({
        bucket: 'my-bucket',
        projectId: 'my-project',
        serviceAccountKey: validServiceAccountKey
      })

      await expect(ctx.init()).resolves.toBeUndefined()
      expect(mockStorageInstance.bucket).toHaveBeenCalledWith('my-bucket')
    })
  })

  describe('created / updated', () => {
    it('saves the page content to the path derived from page.path', async () => {
      const ctx = makeContext({ publicRead: false })
      ctx.bucket = mockBucket
      const page = {
        path: 'en/home',
        localeCode: 'en',
        contentType: 'markdown',
        injectMetadata: jest.fn(() => 'PAGE CONTENT')
      }

      await ctx.created(page)

      expect(mockBucket.file).toHaveBeenCalledWith('en/home.md')
      expect(mockFile.save).toHaveBeenCalledWith('PAGE CONTENT', { resumable: false })
    })

    it('prefixes the file path with the locale code when namespacing is enabled and the locale differs', async () => {
      global.WIKI.config.lang.namespacing = true
      global.WIKI.config.lang.code = 'en'

      const ctx = makeContext({ publicRead: false })
      ctx.bucket = mockBucket
      const page = {
        path: 'bienvenida',
        localeCode: 'es',
        contentType: 'markdown',
        injectMetadata: jest.fn(() => 'CONTENIDO')
      }

      await ctx.updated(page)

      expect(mockBucket.file).toHaveBeenCalledWith('es/bienvenida.md')
    })

    it('makes the file public when publicRead is enabled', async () => {
      const ctx = makeContext({ publicRead: true })
      ctx.bucket = mockBucket
      const page = {
        path: 'en/home',
        localeCode: 'en',
        contentType: 'markdown',
        injectMetadata: jest.fn(() => 'PAGE CONTENT')
      }

      await ctx.created(page)

      expect(mockFile.makePublic).toHaveBeenCalled()
    })

    it('does not throw when makePublic fails, and logs a warning instead', async () => {
      mockFile.makePublic.mockRejectedValueOnce(new Error('permission denied'))
      const ctx = makeContext({ publicRead: true })
      ctx.bucket = mockBucket
      const page = {
        path: 'en/home',
        localeCode: 'en',
        contentType: 'markdown',
        injectMetadata: jest.fn(() => 'PAGE CONTENT')
      }

      await expect(ctx.created(page)).resolves.toBeUndefined()
      expect(global.WIKI.logger.warn).toHaveBeenCalled()
    })
  })

  describe('deleted', () => {
    it('deletes the file at the page path, ignoring not-found errors', async () => {
      const ctx = makeContext({})
      ctx.bucket = mockBucket
      const page = { path: 'en/old-page', localeCode: 'en', contentType: 'markdown' }

      await ctx.deleted(page)

      expect(mockBucket.file).toHaveBeenCalledWith('en/old-page.md')
      expect(mockFile.delete).toHaveBeenCalledWith({ ignoreNotFound: true })
    })
  })

  describe('renamed', () => {
    it('moves the file from the source path to the destination path', async () => {
      const ctx = makeContext({})
      ctx.bucket = mockBucket
      const page = {
        path: 'en/old-path',
        destinationPath: 'en/new-path',
        localeCode: 'en',
        destinationLocaleCode: 'en',
        contentType: 'markdown'
      }

      await ctx.renamed(page)

      expect(mockBucket.file).toHaveBeenCalledWith('en/old-path.md')
      expect(mockFile.move).toHaveBeenCalledWith('en/new-path.md')
    })

    it('namespaces source and destination independently when locales differ', async () => {
      global.WIKI.config.lang.namespacing = true
      global.WIKI.config.lang.code = 'en'

      const ctx = makeContext({})
      ctx.bucket = mockBucket
      const page = {
        path: 'bienvenida',
        destinationPath: 'welcome',
        localeCode: 'es',
        destinationLocaleCode: 'fr',
        contentType: 'markdown'
      }

      await ctx.renamed(page)

      expect(mockBucket.file).toHaveBeenCalledWith('es/bienvenida.md')
      expect(mockFile.move).toHaveBeenCalledWith('fr/welcome.md')
    })
  })

  describe('assets', () => {
    it('assetUploaded saves the asset data to its path', async () => {
      const ctx = makeContext({ publicRead: false })
      ctx.bucket = mockBucket
      const asset = { path: 'uploads/logo.png', data: Buffer.from('binary') }

      await ctx.assetUploaded(asset)

      expect(mockBucket.file).toHaveBeenCalledWith('uploads/logo.png')
      expect(mockFile.save).toHaveBeenCalledWith(asset.data, { resumable: false })
    })

    it('assetDeleted deletes the file, ignoring not-found errors', async () => {
      const ctx = makeContext({})
      ctx.bucket = mockBucket
      const asset = { path: 'uploads/logo.png' }

      await ctx.assetDeleted(asset)

      expect(mockFile.delete).toHaveBeenCalledWith({ ignoreNotFound: true })
    })

    it('assetRenamed moves the file to the destination path', async () => {
      const ctx = makeContext({})
      ctx.bucket = mockBucket
      const asset = { path: 'uploads/old.png', destinationPath: 'uploads/new.png' }

      await ctx.assetRenamed(asset)

      expect(mockBucket.file).toHaveBeenCalledWith('uploads/old.png')
      expect(mockFile.move).toHaveBeenCalledWith('uploads/new.png')
    })
  })
})
