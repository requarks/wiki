/**
 * Migration 2.5.150 - set default values for columns users.timezone and users.dateFormat
 */

const { isPostgres } = require('./_helpers')

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE public."users"
    ALTER COLUMN timezone SET DEFAULT 'Europe/Berlin';
    ALTER TABLE public."users"
    ALTER COLUMN "dateFormat" SET DEFAULT 'DD.MM.YYYY';
  `)
}

exports.down = async function (knex) {}
