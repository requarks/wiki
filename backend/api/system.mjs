/**
 * System API Routes
 */
async function routes (app, options) {
  app.get('/info', {
    schema: {
      summary: 'System Info',
      tags: ['System']
    }
  }, async (request, reply) => {
    return { hello: 'world' }
  })
}

export default routes
