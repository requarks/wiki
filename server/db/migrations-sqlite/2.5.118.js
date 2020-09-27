exports.up = async knex => {
  // -> Fix 2.5.117 new installations without isEnabled on local auth (#2382)
  await knex('authentication').where('key', 'local').update({ isEnabled: true })
}

exports.down = knex => { }
