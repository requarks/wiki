const renderEm = (tokens, idx, opts, env, slf) => {
  const token = tokens[idx];
  if (token.markup === '_') {
    token.tag = 'u';
  }
  return slf.renderToken(tokens, idx, opts);
}

module.exports = (md) => {
  md.renderer.rules.em_open = renderEm;
  md.renderer.rules.em_close = renderEm;
}
