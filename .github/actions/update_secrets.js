// Initial code commit by Hari Kumar Munjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const exec = require('@actions/exec');

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

// Securely handle self-signed certificates during debugging
if (debugMode) {
  console.warn(
    "WARNING: debugMode is set to true. This disables TLS certificate validation. Do not use in production."
  );

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Ignore certificate validation
  process.env.DEBUG = 'fetch'; // Enable debug information for the fetch library

  debugCommands.push(
    `NODE_TLS_REJECT_UNAUTHORIZED=${process.env.NODE_TLS_REJECT_UNAUTHORIZED}`,
    `DEBUG=${process.env.DEBUG}`
  );
  debugCommands.forEach(command => debugLog(`Debug command: ${command}`));
}

// Input parameters
const apiToken = core.getInput('apiToken', { required: true });
const endPoint = core.getInput('endPoint', { required: true });
const secretsJSON = core.getInput('secretsArray');
const githubUser = process.env.GITHUB_ACTOR;

/**
 * Fetches all secrets from the API.
 * @returns {Promise<Object[]>} - The list of secrets from the API.
 */
async function getAllSecretsFromAPI() {
  try {
    const getSecretEndpoint = `${endPoint}/config/secrets`;
    const getResponse = await fetch(getSecretEndpoint, {
      method: 'GET',
      headers: {
        'x-api-key': apiToken,
      },
    });

    if (!getResponse.ok) {
      throw new Error('Failed to fetch secrets');
    }

    const returnResponse = await getResponse.json();
    debugLog(`Fetched secrets from API: ${JSON.stringify(returnResponse)}`);
    return returnResponse;
  } catch (error) {
    console.error(`Error while querying secrets: ${error.message}`);
    throw error;
  }
}

/**
 * Deploys secrets to the API, either updating or creating as necessary.
 */
async function deploySecret() {
  try {
    if (secretsJSON) {
      const secretsRes = await getAllSecretsFromAPI();
      const secretsJSONObj = JSON.parse(secretsJSON);

      for (const key in secretsJSONObj) {
        if (Object.hasOwnProperty.call(secretsJSONObj, key)) {
          const userChars = githubUser.substring(0, 3).toUpperCase();

          if (key.startsWith('CTM_') || key.startsWith(userChars)) {
            if (secretsRes.includes(key)) {
              debugLog(`Updating existing secret: ${key}`);
              const updateSecret = `${endPoint}/config/secret/${key}`;
              const updateResponse = await fetch(updateSecret, {
                method: 'POST',
                headers: {
                  'x-api-key': apiToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value: secretsJSONObj[key] }),
              });

              const HTTP_CODE = updateResponse.status;
              const outputContent = await updateResponse.text();
              console.log(outputContent);

              if (HTTP_CODE !== 200) {
                throw new Error(`Update secret for ${key} failed with HTTP code ${HTTP_CODE}`);
              }
            } else {
              debugLog(`Creating new secret: ${key}`);
              const createSecret = `${endPoint}/config/secret`;
              const createResponse = await fetch(createSecret, {
                method: 'POST',
                headers: {
                  'x-api-key': apiToken,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: key, value: secretsJSONObj[key] }),
              });

              const HTTP_CODE = createResponse.status;
              const outputContent = await createResponse.text();
              console.log(outputContent);

              if (HTTP_CODE !== 200) {
                throw new Error(`Create secret for ${key} failed with HTTP code ${HTTP_CODE}`);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error during secret deployment: ${error.message}`);
    process.exit(1);
  }
}

// Main execution
deploySecret().catch(error => {
  console.error(`Deployment failed: ${error.message}`);
  process.exit(1);
});
