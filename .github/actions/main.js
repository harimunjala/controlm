//Initial code commit by Hari Kumar Munjala
const fs = require('fs/promises');
const path = require('path');
const core = require('@actions/core');

async function run() {
  const deployCommand = core.getInput('deployCommand', { required: true });

  if (!deployCommand) {
    console.error('No command provided.');
    process.exit(1);
  }

  const commandFilePath = path.join(__dirname, `${deployCommand}.js`);

  console.log(commandFilePath);

  try {
    // Check if the command file exists
    await checkFileAccess(commandFilePath);

    // Execute the command
    require(commandFilePath);
  } catch (error) {
    console.error(`Error accessing or executing command file: ${deployCommand}`);
    console.error(error.message);
    process.exit(1);
  }
}

async function checkFileAccess(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }
}

// Call the run function asynchronously
(async () => {
  try {
    await run();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();