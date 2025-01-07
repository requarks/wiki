/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dev\/cypress\/"
  ],
  "reporters": [
      [
        "jest-junit",
        {
          "outputDirectory": "./test-results",
          "outputName": "report.xml",
          "addFileAttribute": "true"
        }
      ]
   ]
};

module.exports = config;
