exports.up = async knex => {
  await knex('users').update({
    email: knex.raw('LOWER(??)', ['email'])
  })
}

exports.down = knex => { }
