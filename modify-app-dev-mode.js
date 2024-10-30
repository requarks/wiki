const fs = require('fs');

// Get command-line argument for dev_mode (true or false)
const devMode = process.argv[2];
if (!devMode || (devMode !== 'true' && devMode !== 'false')) {
  console.error('Usage: node modify-app-dev-mode.js <dev_mode (true/false)>');
  process.exit(1);
}

// Path to package.json
const packageJsonPath = './package.json';

// Read the package.json file
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Modify the 'dev' field based on the dev_mode argument
packageJson.dev = (devMode === 'true');

// Write the updated content back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

console.log(`Updated package.json with dev mode set to ${devMode}`);
