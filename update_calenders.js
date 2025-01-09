// Initial code commit by harimunjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { Readable } = require('stream');
//const github = require('actions/github');
//const exec = require('@actions/exec');

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
const folderPath = core.getInput('dist-folder', { required: true }) + '/calendars';

async function deployFile(file) {
  try {

    debugLog(`\n================================================================================================================\n Deploying ${file}\n================================================================================================================\n`);

    // Read file content
    const fileContentStream = await fs.readFile(`${folderPath}/${file}`, 'utf-8');

    // Create a readable stream from file content
    const stream = Readable.from(fileContentStream);

    // Create FormData instance
    const formData = new FormData();
    formData.append('definitionsFile', stream, { filename: file });

    // Make API call using native fetch
    const response = await fetch(`${endPoint}/deploy`, {
      method: 'POST',
      headers: {
        'x-api-key': apiToken,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    // Fetch HTTP code and response text
    const { status: HTTP_CODE } = response;
    const outputContent = await response.text();

    // Print the output for pipeline monitoring
    console.log(outputContent);

    // Exit when API call failed
    if (HTTP_CODE !== 200) {
      console.error(`Deployment for ${file} failed with http code ${HTTP_CODE}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error deploying ${file}: ${error.message}`);
    process.exit(1);
  }
}

async function deployFiles() {
  try {
    const folderExists = await directoryExists(folderPath);
    if (!folderExists) {
      console.log(`Folder does not exist: ${folderPath}. No files to deploy.`);
      return;
    }
    const files = await fs.readdir(folderPath);

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
