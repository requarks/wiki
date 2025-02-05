const fs = require('fs');

// Get command-line arguments for version
const version = process.argv[2];
if (!version) {
  console.error('Image tag is empty, Usage: node modify-package-json.js <version>');
  process.exit(0);
}

// Get the current date in ISO 8601 format
const releaseDate = new Date().toISOString();

// Path to package.json
const packageJsonPath = './package.json';

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Modify the version and releaseDate fields
packageJson.version = version;
packageJson.releaseDate = releaseDate;

// Write the updated content back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`Updated package.json with version ${version} and releaseDate ${releaseDate}`);
