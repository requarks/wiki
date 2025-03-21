exports.up = knex => {
  // PAGE MENTIONS --------------------------
  return knex.schema
    .createTable('userMentions', table => {
      table.increments('id').primary()
      table.integer('pageId').unsigned().references('id').inTable('pages').onDelete('CASCADE')
      table.integer('commentId').unsigned().references('id').inTable('comments').onDelete('CASCADE')
      table.integer('userId').unsigned().references('id').inTable('users').onDelete('CASCADE')
    })
}

exports.down = knex => { }
