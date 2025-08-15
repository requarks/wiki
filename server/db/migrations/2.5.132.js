exports.up = async knex => {
  return knex.schema.table('groups', table => {
    table.renameColumn('pageRules', 'rules')
  })
}

exports.down = knex => { }
