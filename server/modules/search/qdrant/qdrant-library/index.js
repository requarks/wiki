const { body_request, url_request } = require("./request.js");

const base_url = "http://localhost:6333/";

const QdrantResponse = function(response) {
	this.err = response[0];
	this.response = response[1];
}

const Qdrant = function(url, apiKey){
  this.url = url||base_url;
  this.apiKey = apiKey || '';
}

//DELETE http://localhost:6333/collections/{collection_name}
Qdrant.prototype.delete_collection = async function (name) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}`;
	return new QdrantResponse(await body_request(url,null,'DELETE', this.apiKey));
}

//PUT http://localhost:6333/collections/{collection_name}
Qdrant.prototype.create_collection = async function (name,body,indexConfig) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}`;
	const response = new QdrantResponse(await body_request(url,body,'PUT', this.apiKey));
  if (indexConfig) {
    new QdrantResponse(await body_request(url + '/index',indexConfig,'PUT', this.apiKey));
  };

  return response;
}

//GET http://localhost:6333/collections/{collection_name}
Qdrant.prototype.get_collection = async function (name) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}`;
	return new QdrantResponse(await url_request(url));
}


//PUT http://localhost:6333/collections/{collection_name}/points
Qdrant.prototype.upload_points = async function (name,points) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}/points`;	
	return new QdrantResponse(await body_request(url,{points:points},'PUT', this.apiKey));
}

//POST http://localhost:6333/collections/{collection_name}/points/search
Qdrant.prototype.search_collection = async function (name,vector,k,ef,filter) {
	k = k || 5;
	ef = ef || 128;
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}/points/search`;
	let query = {
		"params": {
			"hnsw_ef": ef
		},
		"vector": vector,
		"top": k,
    "with_payload": true,
    "with_vectors": true
	};
	if (filter) query.filter = filter;
	return new QdrantResponse(await body_request(url,query,'POST', this.apiKey));
}


//Same as search_collection but allows free-form query by the client
Qdrant.prototype.query_collection = async function (name,query) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}/points/search`;
	return new QdrantResponse(await body_request(url,query,'POST', this.apiKey));
}

//Get the specific points by ids
Qdrant.prototype.retrieve_points = async function (name,query) {
	let qdrant_url = this.url;
	let url = `${qdrant_url}collections/${name}/points`;
	return new QdrantResponse(await body_request(url,query,'POST', this.apiKey));
}

module.exports = {
  Qdrant
};
