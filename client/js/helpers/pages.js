
function makeSafePath(rawPath) {

	let rawParts = _.split(_.trim(rawPath), '/');
	rawParts = _.map(rawParts, (r) => {
		return _.kebabCase(_.deburr(_.trim(r)));
	});

	return _.join(_.filter(rawParts, (r) => { return !_.isEmpty(r); }), '/');

}