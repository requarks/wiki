/* global WIKI */

exports.up = async knex => {
  await knex.schema.alterTable('tags', table => {
    table.dropUnique('tag', 'tags_tag_unique');
  })
}

exports.down = async knex => {
}
