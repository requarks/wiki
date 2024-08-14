/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dev\/cypress\/"
  ]
};

module.exports = config;
