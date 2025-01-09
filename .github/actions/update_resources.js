// Initial code commit by Hari Kumar Munjala

const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');

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
const folderPath = core.getInput('dist-folder', { required: true }) + '/resources';

async function checkResourceAvailability(ctmName, resName) {
  const resourceCheckEndpoint = `${endPoint}/run/resources`;
  const response = await fetch(resourceCheckEndpoint, {
    method: 'GET',
    headers: {
      'x-api-key': apiToken
    }
  });
  const resources = await response.json();
  return resources.some(resource => resource.ctm === ctmName && resource.name === resName);
}

async function deployRes(file) {
  try {
    console.log(`\n================================================================================================================\n Deploying ${file}\n================================================================================================================\n`);
    const filePath = `${folderPath}/${file}`;
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const jsonObject = JSON.parse(fileContent);
    const resName = jsonObject.name;
    const ctmName = jsonObject.ctm;
    const resourceAvailable = await checkResourceAvailability(ctmName, resName);

    if (resourceAvailable) {
      const deleteCommand = `${endPoint}/run/resource/${ctmName}/${resName}`;
      const deleteResponse = await fetch(deleteCommand, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiToken
        }
      });
      const deleteHTTPCode = deleteResponse.status;
      const outputContent = await deleteResponse.text();
      console.log(outputContent);

      if (deleteHTTPCode !== 200) {
        console.error(`Delete resource ${resName} failed with http code ${deleteHTTPCode}`);
        process.exit(1);
      }
    }

    const deployCommand = `${endPoint}/run/resource/${ctmName}`;
    const deployResponse = await fetch(deployCommand, {
      method: 'POST',
      headers: {
        'x-api-key': apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(jsonObject)
    });
    const deployHTTPCode = deployResponse.status;
    const outputDeploy = await deployResponse.text();
    console.log(outputDeploy);

    if (deployHTTPCode !== 200) {
      console.error(`Deployment for ${filePath} failed with http code ${deployHTTPCode}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error deploying resource ${file}: ${error.message}`);
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
          await deployRes(file);
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