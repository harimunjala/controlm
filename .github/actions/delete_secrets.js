//Initial code commit by Hari Kumar Munjala
const core = require('@actions/core');
const fs = require('fs').promises;
const fetch = require('node-fetch');
const exec = require('@actions/exec');
//const github = require('@actions/github');

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
const githubUser = process.env.GITHUB_ACTOR;

async function getAllSecretsFromAPI() {
  try {
    const getSecretEndpoint = `${endPoint}/config/secrets`;
    const getResponse = await fetch(getSecretEndpoint, {
      method: 'GET',
      headers: {
        'x-api-key': apiToken
      }
    });

    if (!getResponse.ok) {
      throw new Error('Failed to fetch secrets');
    }

    const returnResponse = await getResponse.json();
    return returnResponse;
  } catch (error) {
    console.error(`Error while querying secrets: ${error.message}`);
    throw error;
  }
}

async function deleteSecret() {
  try {
      const secretsRes = await getAllSecretsFromAPI();
      const userChars = githubUser.substring(0, 3).toUpperCase();
      secretsRes.forEach(async key => {
        if (key.startsWith(userChars)) {
          const deleteSecret = `${endPoint}/config/secret/${key}`;
          console.log(`${key} exists in Control-M`)
          const deleteResponse = await fetch(deleteSecret, {
            method: 'DELETE',
            headers: {
              'x-api-key': apiToken,
              'Content-Type': 'application/json'
            }
          });
          const HTTP_CODE = deleteResponse.status;
          const outputContent = await deleteResponse.text();
          console.log(outputContent);
          if (HTTP_CODE !== 200) {
            console.error(`Delete secret for ${key} failed with http code ${HTTP_CODE}`);
            process.exit(1);
          }
        }
      });    
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

deleteSecret().catch(error => {
  console.error(error);
  process.exit(1);
});
