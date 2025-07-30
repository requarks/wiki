const Comment = require('../../models/comments')

const WIKI = {
  data: {
    commentProvider: {
      getCommentById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn()
    }
  },
  models: {
    pages: {
      getPageFromDb: jest.fn()
    }
  },
  auth: {
    isSuperAdmin: jest.fn(),
    checkAccess: jest.fn()
  },
  Error: {
    CommentManageForbidden: class extends Error {},
    CommentNotFound: class extends Error {},
    PageNotFound: class extends Error {}
  }
}

describe('Comment model permissions', () => {
  let authorUser, otherUser, superAdmin, comment, page

  beforeEach(() => {
    authorUser = { id: 42, name: 'Author', email: 'a@b.com' }
    otherUser = { id: 99, name: 'Other', email: 'o@b.com' }
    superAdmin = { id: 1, name: 'Admin', email: 'admin@b.com' }
    comment = { id: 10, pageId: 1, authorId: 42, content: 'abc' }
    page = { id: 1, path: '/test', localeCode: 'en', tags: [], siteId: 1 }

    global.WIKI = WIKI
    WIKI.data.commentProvider.getCommentById.mockResolvedValue(comment)
    WIKI.models.pages.getPageFromDb.mockResolvedValue(page)
    WIKI.auth.checkAccess.mockReturnValue(true)
    WIKI.data.commentProvider.update.mockResolvedValue({ ...comment, content: 'updated' })
    WIKI.data.commentProvider.remove.mockResolvedValue()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('updateComment', () => {
    it('allows the author to update', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      await expect(Comment.updateComment({ id: 10, content: 'updated', user: authorUser }))
        .resolves.toHaveProperty('content', 'updated')
    })

    it('allows a super admin to update', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(true)
      await expect(Comment.updateComment({ id: 10, content: 'updated', user: superAdmin }))
        .resolves.toHaveProperty('content', 'updated')
    })

    it('forbids others from updating', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      await expect(Comment.updateComment({ id: 10, content: 'updated', user: otherUser }))
        .rejects.toThrow(WIKI.Error.CommentManageForbidden)
    })

    it('forbids update if user lacks manage:own_comments permission', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      WIKI.auth.checkAccess.mockReturnValue(false)

      await expect(Comment.updateComment({ id: 10, content: 'updated', user: authorUser }))
        .rejects.toThrow(WIKI.Error.CommentManageForbidden)
    })
  })

  describe('deleteComment', () => {
    it('allows the author to delete', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      await expect(Comment.deleteComment({ id: 10, user: authorUser }))
        .resolves.toBeUndefined()
    })

    it('allows a super admin to delete', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(true)
      await expect(Comment.deleteComment({ id: 10, user: superAdmin }))
        .resolves.toBeUndefined()
    })

    it('forbids others from deleting', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      await expect(Comment.deleteComment({ id: 10, user: otherUser }))
        .rejects.toThrow(WIKI.Error.CommentManageForbidden)
    })
    it('forbids delete if user lacks manage:own_comments permission', async () => {
      WIKI.auth.isSuperAdmin.mockReturnValue(false)
      WIKI.auth.checkAccess.mockReturnValue(false)

      await expect(Comment.deleteComment({ id: 10, user: authorUser }))
        .rejects.toThrow(WIKI.Error.CommentManageForbidden)
    })
  })
})
