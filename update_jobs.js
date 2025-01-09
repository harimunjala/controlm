// Initial code commit by Hari Kumar Munjala
const core = require('@actions/core');
const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { Readable } = require('stream');

const debugMode = core.getInput('debugMode', { required: true }) === 'true'; // Ensure debugMode is a boolean
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

// Set environment variables and log debug configuration
if (debugMode) {
  console.warn(
    "WARNING: debugMode is set to true. This disables TLS certificate validation. Do not use in production."
  );

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore certificate validation
  process.env.DEBUG = 'fetch'; // Enable debug for fetch library

  debugCommands.push(
    `NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`,
    `DEBUG=${process.env.DEBUG}`
  );
  debugCommands.forEach(command => debugLog(`Debug command: ${command}`));
}

// Input parameters
const apiToken = core.getInput('apiToken', { required: true });
const endPoint = core.getInput('endPoint', { required: true });
const deployDescriptor = core.getInput('deployDescriptor', { required: true });
const rootPath = core.getInput('dist-folder', { required: true });
const folderPath = `${rootPath}/jobs`;

/**
 * Deploys a single file to the API.
 * @param {string} file - The file to deploy.
 */
async function deployFile(file) {
  try {
    debugLog(`\n=========================================================\n Deploying ${file}\n=========================================================\n`);

    const fileContentStream = fs.createReadStream(`${folderPath}/${file}`);
    const deployDescriptorStream = fs.createReadStream(`${rootPath}/deploy-descriptors/${deployDescriptor}`);

    const formData = new FormData();
    formData.append('definitionsFile', fileContentStream, { filename: 'definitionsFile.json' });
    formData.append('deployDescriptorFile', deployDescriptorStream, { filename: 'deployDescriptorFile.json' });

    const response = await fetch(`${endPoint}/deploy`, {
      method: 'POST',
      headers: {
        'x-api-key': apiToken,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const { status: HTTP_CODE } = response;
    const outputContent = await response.text();
    console.log(outputContent);

    if (HTTP_CODE !== 200) {
      throw new Error(`Deployment for ${file} failed with HTTP code ${HTTP_CODE}`);
    }
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
    if (!(await directoryExists(folderPath))) {
      console.log(`Folder does not exist: ${folderPath}. No files to deploy.`);
      return;
    }

    const files = await fs.promises.readdir(folderPath);
    console.log(`Found ${files.length} files in ${folderPath}`);

    if (files.length > 0) {
      for (const file of files) {
        if (file.endsWith('.json')) {
          await deployFile(file);
        }
      }
    } else {
      console.log(`No files found in ${folderPath}`);
    }
  } catch (error) {
    console.error(`Error reading directory: ${error.message}`);
    throw error;
  }
}

/**
 * Checks if a directory exists.
 * @param {string} path - The path to the directory.
 * @returns {Promise<boolean>} - Whether the directory exists.
 */
async function directoryExists(path) {
  try {
    const stats = await fs.promises.stat(path);
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
