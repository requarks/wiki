exports.up = async knex => {
  // Create notification banners table
  return knex.schema
    .createTable('notificationBanners', table => {
      table.increments('id').primary()
      table.string('text', 500).notNullable()
      table.string('urgency').notNullable().defaultTo('info')
      table.string('startDate').notNullable()
      table.string('endDate').notNullable()
      table.boolean('isActive').notNullable().defaultTo(true)
      table.timestamp('createdAt').notNullable().defaultTo(knex.fn.now())
      table.timestamp('updatedAt').notNullable().defaultTo(knex.fn.now())
    })
}

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('notificationBanners')
}
