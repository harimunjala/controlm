const core = require('@actions/core');
const fs = require('fs').promises;
const path = require('path');
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
const deployDescriptor = core.getInput('deployDescriptor', { required: true });
const rootPath = core.getInput('dist-folder', { required: true });
const folderPath = rootPath; // Use rootPath as folderPath

// Output directory for transformed files
const newrootPath = rootPath + '_transformed';

async function deployFile(file, filePath) {
  try {
    debugLog(`\n================================================================================================================\n Transforming ${file}\n================================================================================================================\n`);

    const fileContent = await fs.readFile(filePath, 'utf-8');

    const deployDescriptorFilePath = path.join(rootPath, 'deploy-descriptors', deployDescriptor);
    const deployDescriptorFileContent = await fs.readFile(deployDescriptorFilePath, 'utf-8');
    const deployDescriptorStream = Readable.from(deployDescriptorFileContent);

    const formData = new FormData();
    formData.append('definitionsFile', Readable.from(fileContent), { filename: 'definitionsFile.json' });
    formData.append('deployDescriptorFile', deployDescriptorStream, { filename: 'deployDescriptorFile.json' });

    const response = await fetch(`${endPoint}/deploy/transform`, {
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
      throw new Error(`Transformation for ${file} failed with http code ${HTTP_CODE}`);
    }

    // Save transformed content to a new file in the newrootPath directory with the same hierarchy
    const outputFile = path.join(newrootPath, path.relative(rootPath, filePath));
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, outputContent);
  } catch (error) {
    console.error(`Error transforming ${file}: ${error.message}`);
    throw error;
  }
}

async function transformFiles(dir) {
  try {
    const items = await fs.readdir(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = await fs.stat(itemPath);

      if (stats.isDirectory() && item !== 'deploy-descriptors' && item !== 'resources' && item !== 'roles') {
        await transformFiles(itemPath);
      } else if (stats.isFile() && item.endsWith('.json')) {
        await deployFile(item, itemPath);
      }
    }
  } catch (error) {
    console.error(`Error transforming files in ${dir}: ${error.message}`);
    throw error;
  }
}

async function copyDeployDescriptorsFolder() {
    try {
      const deployDescriptorsPath = path.join(rootPath, 'deploy-descriptors');
      const newDeployDescriptorsPath = path.join(newrootPath, 'deploy-descriptors');
      await fs.mkdir(newDeployDescriptorsPath, { recursive: true });
  
      async function copyDirectory(source, target) {
        const items = await fs.readdir(source);
        for (const item of items) {
          const sourcePath = path.join(source, item);
          const targetPath = path.join(target, item);
          const stats = await fs.stat(sourcePath);
          if (stats.isDirectory()) {
            await fs.mkdir(targetPath, { recursive: true });
            await copyDirectory(sourcePath, targetPath);
          } else if (stats.isFile()) {
            await fs.copyFile(sourcePath, targetPath);
          }
        }
      }
  
      await copyDirectory(deployDescriptorsPath, newDeployDescriptorsPath);
    } catch (error) {
      console.error(`Error copying deploy-descriptors folder: ${error.message}`);
      throw error;
    }
  }  

async function startTransformation() {
  try {
    await fs.mkdir(newrootPath, { recursive: true });
    await transformFiles(folderPath);
    await copyDeployDescriptorsFolder();
    console.log(`Transformation completed. Transformed files are saved in ${newrootPath}`);
    core.setOutput("transformPath", newrootPath)
  } catch (error) {
    console.error(`Error during transformation: ${error.message}`);
    throw error;
  }
}

startTransformation().catch(error => {
  console.error(error);
  process.exit(1);
});
