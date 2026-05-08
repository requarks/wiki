---
name: wiki-db-migration
description: Use when adding, modifying, or rolling back database migrations in this Wiki.js repo (Knex + Objection.js)
---

# Database Migrations

Wiki.js uses Knex for migrations and Objection.js as the ORM on top. Migrations are in `server/db/migrations/`.

**Stop and ask the user before touching migrations.** They are irreversible once run against a real DB.

## Creating a Migration

```bash
# From repo root — uses knex CLI via node_modules
node_modules/.bin/knex migrate:make <migration_name> --knexfile server/db/knex.js
```

New file created at `server/db/migrations/<timestamp>_<migration_name>.js`.

## Migration File Structure

```js
exports.up = async (knex) => {
  // additive: create table, add column, add index
  await knex.schema.table('pages', t => {
    t.string('newColumn').defaultTo('')
  })
}

exports.down = async (knex) => {
  // reverse of up — always implement down
  await knex.schema.table('pages', t => {
    t.dropColumn('newColumn')
  })
}
```

## Running Migrations

Wiki.js runs `knex.migrate.latest()` automatically on server start. No manual run needed in dev.

To run manually:
```bash
node_modules/.bin/knex migrate:latest --knexfile server/db/knex.js
node_modules/.bin/knex migrate:rollback --knexfile server/db/knex.js
```

## Updating Objection Models

After schema change, update the corresponding model in `server/models/<model>.js`:
- Add new column to model's `jsonSchema` if validation needed
- Add relation if new FK

## Safety Rules

- **Always implement `exports.down`** — enables rollback
- **Never edit a committed migration** — create a new one instead
- **Test rollback** in dev: `migrate:rollback` then `migrate:latest` must both succeed without errors
- **Multi-DB awareness** — migrations run on postgres, mysql, mariadb, mssql, sqlite. Avoid DB-specific SQL. Use Knex schema builder API.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `exports.down` | Add it — rollback fails silently otherwise |
| Raw SQL with postgres syntax | Use Knex schema API for portability |
| Dropping column without null check | Add `.nullable()` or default first in a prior migration |
| Forgetting to update Objection model | Queries return `undefined` for new column |
