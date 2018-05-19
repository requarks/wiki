exports.seed = (knex, Promise) => {
  return knex('settings')
    .insert([
      { key: 'auth', value: {} },
      { key: 'features', value: {} },
      { key: 'logging', value: {} },
      { key: 'site', value: {} },
      { key: 'theme', value: {} },
      { key: 'uploads', value: {} }
    ])
}
