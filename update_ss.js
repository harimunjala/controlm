// Initial code commit by harimunjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { Readable } = require('stream');

const debugMode = core.getInput('debugMode', { required: false }) === 'true'; // Debug mode as a boolean
const debugCommands = [];

/**
 * Logs debug messages when debugMode is enabled.
 * @param {string} message - The debug message to log.
 */
function debugLog(message) {
  if (debugMode) {
    console.log(message);
  }
}

// Handle self-signed certificates in debug mode
if (debugMode) {
  console.warn(
    "WARNING: debugMode is set to true. This disables TLS certificate validation. Do not use in production."
  );

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Insecure TLS handling for debugging
  process.env.DEBUG = 'fetch'; // Enable fetch library debug logs

  debugCommands.push(
    `NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`,
    `DEBUG=${process.env.DEBUG}`
  );

  debugCommands.forEach(command => debugLog(`Debug command: ${command}`));
}

// Input parameters
const apiToken = core.getInput('apiToken', { required: true });
const endPoint = core.getInput('endPoint', { required: true });
const folderPath = `${core.getInput('dist-folder', { required: true })}/site-standards`; // Clearer folder path

/**
 * Deploys a single JSON file to the endpoint.
 * @param {string} file - The file name to deploy.
 */
async function deployFile(file) {
  try {
    debugLog(`\n=========================================================\n Deploying ${file}\n=========================================================\n`);

    const filePath = `${folderPath}/${file}`;
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const fileStream = Readable.from(fileContent);

    const formData = new FormData();
    formData.append('definitionsFile', fileStream, { filename: 'definitionsFile.json' });

    const response = await fetch(`${endPoint}/deploy`, {
      method: 'POST',
      headers: {
        'x-api-key': apiToken,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const responseText = await response.text();
    console.log(responseText);

    if (response.status !== 200) {
      throw new Error(`Deployment for ${file} failed with HTTP status ${response.status}`);
    }

    debugLog(`Successfully deployed file: ${file}`);
  } catch (error) {
    console.error(`Error deploying ${file}: ${error.message}`);
    throw error;
  }
}

/**
 * Deploys all JSON files in the specified folder.
 */
async function deployFiles() {
  try {
    const folderExists = await directoryExists(folderPath);
    if (!folderExists) {
      console.log(`Folder does not exist: ${folderPath}. No files to deploy.`);
      return;
    }

    const files = await fs.readdir(folderPath);
    console.log(`Found ${files.length} files in ${folderPath}`);

    const jsonFiles = files.filter(file => file.endsWith('.json'));
    if (jsonFiles.length === 0) {
      console.log(`No JSON files found in ${folderPath}`);
      return;
    }

    for (const file of jsonFiles) {
      await deployFile(file);
    }
  } catch (error) {
    console.error(`Error during deployment process: ${error.message}`);
    throw error;
  }
}

/**
 * Checks whether a directory exists.
 * @param {string} path - The directory path.
 * @returns {Promise<boolean>} - True if the directory exists, false otherwise.
 */
async function directoryExists(path) {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Main execution
deployFiles().catch(error => {
  console.error(`Deployment failed: ${error.message}`);
  process.exit(1);
});
