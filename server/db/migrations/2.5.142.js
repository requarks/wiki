exports.up = knex => {
  return knex.schema
    .alterTable('pageTags', table => {
      table.index('pageId', 'idx_pageTags_pageId')
      table.index('tagId', 'idx_pageTags_tagId')
    })
    .alterTable('pages', table => {
      table.index('creatorId', 'pages_creatorId_idx')
      table.index('authorId', 'pages_authorId_idx')
      table.index(['siteId', 'localeCode', 'path'], 'pages_siteId_localeCode_path_idx')
    })
}

exports.down = knex => {
  return knex.schema
    .alterTable('pageTags', table => {
      table.dropIndex('pageId', 'idx_pageTags_pageId')
      table.dropIndex('tagId', 'idx_pageTags_tagId')
    })
    .alterTable('pages', table => {
      table.dropIndex('creatorId', 'pages_creatorId_idx')
      table.dropIndex('authorId', 'pages_authorId_idx')
      table.dropIndex(['siteId', 'localeCode', 'path'], 'pages_siteId_localeCode_path_idx')
    })
}