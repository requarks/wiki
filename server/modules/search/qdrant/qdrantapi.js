
const QdrantResponse = function (response) {
  this.err = response[0]
  this.response = response[1]
}

class Qdrant {
  constructor(url, apiKey) {
    this.url = url || 'http://localhost:6333/'
    this.apiKey = apiKey
  }
  async urlRequest(url, params) {
    url = this.url + url
    if (params) {
      url += '?' + new URLSearchParams(params).toString()
    }
    let fetchSpec = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      }
    }
    let response = await fetch(url, fetchSpec)

    try {
      const output = await response.json()
      return [null, output]
    } catch (ex) {
      const output = null
      return [ex, output]
    }
  }

  async bodyRequest(url, body, method) {
    url = this.url + url
    method = method || 'POST'

    let fetchSpec = {
      method: method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      }
    }

    if (body) fetchSpec.body = JSON.stringify(body)

    let response = await fetch(url, fetchSpec)

    try {
      const output = await response.json()
      return [null, output]
    } catch (ex) {
      const output = null
      return [ex, output]
    }
  }

  // DELETE http://localhost:6333/collections/{collection_name}
  async deleteCollection(name) {
    let url = `collections/${name}`
    return new QdrantResponse(await this.bodyRequest(url, null, 'DELETE'))
  }

  // PUT http://localhost:6333/collections/{collection_name}
  async createCollection(name, body) {
    let url = `collections/${name}`
    return new QdrantResponse(await this.bodyRequest(url, body, 'PUT'))
  }

  // GET http://localhost:6333/collections/{collection_name}
  async getCollection(name) {
    let url = `collections/${name}`
    return new QdrantResponse(await this.urlRequest(url))
  }

  // PUT http://localhost:6333/collections/{collection_name}/points
  async uploadPoints (name, points) {
    let url = `collections/${name}/points`
    return new QdrantResponse(await this.bodyRequest(url, { points: points }, 'PUT'))
  }

  // POST http://localhost:6333/collections/{collection_name}/points/search
  async searchCollection(name, vector, k, ef, filter) {
    k = k || 5
    ef = ef || 128
    let url = `collections/${name}/points/search`
    let query = {
      'params': {
        'hnsw_ef': ef
      },
      'vector': vector,
      'top': k,
      'with_payload': true
    }
    if (filter) query.filter = filter
    return new QdrantResponse(await this.bodyRequest(url, query, 'POST'))
  }

  // Same as search_collection but allows free-form query by the client
  async queryCollection(name, query) {
    let url = `collections/${name}/points/search`
    return new QdrantResponse(await this.bodyRequest(url, query, 'POST'))
  }

  // Get the specific points by ids
  async retrievePoints(name, query) {
    let url = `collections/${name}/points`
    return new QdrantResponse(await this.bodyRequest(url, query, 'POST'))
  }

  // PUT /collections/{ collection_name } /index
  async indexCollection (name, schema) {
    let url = `collections/${name}/index`
    return new QdrantResponse(await this.bodyRequest(url, schema, 'PUT'))
  }
}

module.exports = {
  Qdrant: Qdrant
}
