// Initial code commit by Hari Kumar Munjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { Readable } = require('stream');

const debugMode = core.getInput('debugMode', { required: false }) === 'true'; // Debug mode as a boolean
const debugCommands = [];

function debugLog(message) {
  if (debugMode) {
    console.log(message);
  }
}

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

const apiToken = core.getInput('apiToken', { required: true });
const endPoint = core.getInput('endPoint', { required: true });
const folderPath = core.getInput('dist-folder', { required: true }) + '/roles';

async function deployFile(file) {
  try {
    debugLog(`\n================================================================================================================\n Deploying ${file}\n================================================================================================================\n`);

    const filePath = `${folderPath}/${file}`;

    const fileContentStream = await fs.readFile(filePath, 'utf-8'); // Updated to use fs.readFile
    const stream = Readable.from(fileContentStream);

    const formData = new FormData();
    formData.append('roleFile', stream, { filename: 'definitionsFile.json' });

    const response = await fetch(`${endPoint}/config/authorization/role`, {
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
      throw new Error(`Deployment for ${file} failed with http code ${HTTP_CODE}`);
    }
  } catch (error) {
    console.error(`Error deploying ${file}: ${error.message}`);
    throw error;
  }
}

async function deployFiles() {
  try {
    // Check if the directory exists
    const folderExists = await directoryExists(folderPath);
    if (!folderExists) {
      console.log(`Folder does not exist: ${folderPath}. No files to deploy.`);
      return;
    }

    const files = await fs.readdir(folderPath); // Updated to use fs.readdir

    console.log(`Found ${files.length} files in ${folderPath}`);

    if (files.length > 0) {
      for (const file of files) {
        // Deploy only if it's a JSON file
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

async function directoryExists(path) {
  try {
    const stats = await fs.stat(path);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

deployFiles().catch(error => {
  console.error(error);
  process.exit(1);
});