// Initial code commit by harimunjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const FormData = require('form-data');
const { Readable } = require('stream');

const debugMode = core.getInput('debugMode', { required: true }) === 'true'; // Ensure debugMode is a boolean
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

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore certificate validation
  process.env.DEBUG = 'fetch'; // Enable debug for fetch library

  debugCommands.push(
    `NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`,
    `DEBUG=${process.env.DEBUG}`
  );
  debugCommands.forEach(command => debugLog(`Debug command: ${command}`));
}

const apiToken = core.getInput('apiToken', { required: true });
const endPoint = core.getInput('endPoint', { required: true });
const folderPath = core.getInput('dist-folder', { required: true }) + '/roles';

async function updateRole(roleName, fileContentStream) {
  const formData = new FormData();
  formData.append('roleFile', Readable.from(fileContentStream), { filename: 'roleFile.json' });

  const updateResponse = await fetch(`${endPoint}/config/authorization/role/${roleName}`, {
    method: 'POST',
    headers: {
      'x-api-key': apiToken,
      ...formData.getHeaders(),
    },
    body: formData,
  });
  const updateHTTPCode = updateResponse.status;
  const updateOutputContent = await updateResponse.text();
  console.log(updateOutputContent);
  return { updateHTTPCode };
}

async function addRole(roleName, fileContentStream) {
  console.log(`Trying to add new role: ${roleName}`)
  const formData = new FormData();
  formData.append('roleFile', Readable.from(fileContentStream), { filename: 'roleFile.json' });

  const addResponse = await fetch(`${endPoint}/config/authorization/role`, {
    method: 'POST',
    headers: {
      'x-api-key': apiToken,
      ...formData.getHeaders(),
    },
    body: formData,
  });
  const addHTTPCode = addResponse.status;
  const addOutputContent = await addResponse.text();
  console.log(addOutputContent);
  return { addHTTPCode };
}

async function deployFile(file) {
  try {
    debugLog(`\n================================================================================================================\n Deploying ${file}\n================================================================================================================\n`);

    const filePath = `${folderPath}/${file}`;
    const fileContentStream = await fs.readFile(filePath, 'utf-8');

    const jsonObject = JSON.parse(fileContentStream);
    const roleName = jsonObject.Name;
    console.log(`Trying to update if role: ${roleName} exists in CTM`);

    const { updateHTTPCode } = await updateRole(roleName, fileContentStream);

    let addHTTPCode;
    if (updateHTTPCode === 400) {
      const { addHTTPCode: addCode } = await addRole(roleName, fileContentStream);
      addHTTPCode = addCode;
    }

    if (updateHTTPCode !== 200 && addHTTPCode !== 200) {
      throw new Error(`Deployment for ${file} failed with HTTP code ${updateHTTPCode} for update and ${addHTTPCode} for add`);
    }
  } catch (error) {
    console.error(`Error deploying ${file}: ${error.message}`);
    throw error;
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
