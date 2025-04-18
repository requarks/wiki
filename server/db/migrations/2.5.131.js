exports.up = async knex => {
  await knex('pages')
    .update({
      orderPriority: knex.raw('(SELECT row_number FROM (SELECT id, row_number() OVER (ORDER BY title ASC) FROM pages) AS sorted WHERE sorted.id = pages.id)')
    })
}

exports.down = knex => { }
