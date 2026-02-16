/**
 * Migration helpers
 *
 * Keep small, dependency-free helpers here so migrations can share common logic
 * without repeating themselves.
 */

/**
 * Returns true if this Knex instance is using a Postgres client.
 *
 * Knex client values commonly used for Postgres:
 * - pg
 * - pg-native
 *
 * @param {import('knex').Knex} knex
 */
function isPostgres(knex) {
    const client = knex?.client?.config?.client
    return client === 'pg' || client === 'pg-native'
}

module.exports = {
    isPostgres
}
