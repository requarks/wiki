const PageHistory = require('../../models/pageHistory')

const WIKI = {
  models: {
    pageHistory: {
      query: jest.fn()
    }
  }
}

describe('PageHistory.anonymizeMentionsByPageIds', () => {
  beforeEach(() => {
    global.WIKI = WIKI
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should patch histories with anonymized content', async () => {
    const pageIds = [123, 456]
    const email = 'user@email.com'
    const anonymizeFn = jest.fn((content, type) => 'ANONYMIZED')

    const mockPatch = jest.fn().mockReturnThis()
    WIKI.models.pageHistory.query.mockReturnValueOnce({
      whereIn: jest.fn(() => ({
        where: jest.fn(cb => {
          // Simulate SQL filtering by returning only histories with the email
          return [
            { id: 1, content: 'Hello @user@email.com', contentType: 'markdown' },
            { id: 2, content: '<span class="mention" data-mention="user@email.com">@user@email.com</span>', contentType: 'html' }
          ]
        })
      }))
    }).mockReturnValue({
      patch: mockPatch,
      where: jest.fn(() => ({}))
    })

    await PageHistory.anonymizeMentionsByPageIds(pageIds, anonymizeFn, email)

    // Should call anonymizeFn for each history
    expect(anonymizeFn).toHaveBeenCalledTimes(2)
    expect(anonymizeFn).toHaveBeenCalledWith('Hello @user@email.com', 'markdown')
    expect(anonymizeFn).toHaveBeenCalledWith('<span class="mention" data-mention="user@email.com">@user@email.com</span>', 'html')

    // Should patch both histories with new content
    expect(mockPatch).toHaveBeenCalledWith({ content: 'ANONYMIZED' })
  })

  it('should not patch if content is unchanged', async () => {
    const pageIds = [123]
    const email = 'user@email.com'
    const anonymizeFn = jest.fn((content, type) => content) // returns original content

    const mockPatch = jest.fn().mockReturnThis()
    WIKI.models.pageHistory.query.mockReturnValueOnce({
      whereIn: jest.fn(() => ({
        where: jest.fn(cb => {
          // Simulate SQL filtering by returning only histories with the email
          return [
            { id: 1, content: 'Hello @user@email.com', contentType: 'markdown' },
            { id: 2, content: '<span class="mention" data-mention="user@email.com">@user@email.com</span>', contentType: 'html' }
          ]
        })
      }))
    }).mockReturnValue({
      patch: mockPatch,
      where: jest.fn(() => ({}))
    })

    await PageHistory.anonymizeMentionsByPageIds(pageIds, anonymizeFn, email)

    // Should call anonymizeFn for each history
    expect(anonymizeFn).toHaveBeenCalled()
    // Should not patch since content is unchanged
    expect(mockPatch).not.toHaveBeenCalled()
  })
})
