# Custom CTM GitHub Action

## Overview
This custom GitHub Action is designed to facilitate various deployment tasks related to Control-M (CTM) using the Automation API. It accepts several inputs to configure and execute different commands within the CTM environment.

## Inputs

### 1. `deployCommand`
- Description: Specifies the command to be executed by the custom CTM GitHub Action.
- Required: Yes

### 2. `apiToken`
- Description: The Automation API token used for authentication.
- Required: Yes

### 3. `endPoint`
- Description: The Automation API endpoint.
- Required: Yes

### 4. `deployDescriptor`
- Description: Path to the deploy descriptor file, required for certain commands.
- Required: No

### 5. `secretsArray`
- Description: This input is used to update/add secrets specific to the repository context. Secrets should be prefixed with 'CTM_' or the starting three letters of the GitHub user in uppercase (e.g., 'HMU_' for 'hmunjala' secrets to Control-M secrets).
- Required: No

### 6. `dist-folder`
- Description: Specifies the folder path where the deployment will occur. By default, GitHub workspace is the processing folder, but users can pass a custom folder path if they use GitHub actions to download artifacts to a custom location.
- Required: No

### 7. `debugMode`
- Description: If debugMode is set to true enables debug logs and disables TLS certifcate validation. Do not set debugMode to true in production. By default debugMode is set to false.
- Required: No

## Notes
- The "required" key indicates the minimum required inputs to call these GitHub actions. Additional inputs might be required based on individual commands, and these are taken care of in the JavaScript.
- Placeholder is provided to handle response output. Current job output is displayed through console logs.

## Example Workflow

```yaml
name: Updating on CTM QA

on:
  push:
    branches:
      - CTM-QA
    paths:
      - 'calendars/*.json'
      - 'resources/*.json'
      - 'connection-profiles/*.json'
      - 'jobs/*.json'

jobs:

  deploy-jobs-qa-aws-demo:
    needs: [deploy-resources-qa-aws-demo, deploy-calenders-qa-aws-demo, deploy-connectionprofiles-qa-aws-demo]
    runs-on: gitrunner
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Deploy Jobs using AAPI
        uses: harimunjala/controlm@v1.0.0-beta
        with:
          deployCommand: update_jobs
          endPoint: ${{ vars.QA_AWS_ENDPOINT }}
          apiToken: ${{ secrets.QA_AWS_TOKEN }}
          deployDescriptor: qa-aws-demo.json
          debugMode: false

  deploy-secrets-qa-aws-demo:
    runs-on: gitrunner
    steps:
      - name: Deploy Secrets using AAPI
        uses: harimunjala/controlm@v1.0.0-beta
        with:
          deployCommand: update_secrets
          endPoint: ${{ vars.QA_AWS_ENDPOINT }}
          apiToken: ${{ secrets.QA_AWS_TOKEN }}
          secretsArray: '${{ toJson(secrets) }}'

  deploy-calenders-qa-aws-demo:
    runs-on: gitrunner
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Deploy Calendars using AAPI
        uses: harimunjala/controlm@v1.0.0-beta
        with:
          deployCommand: update_calenders
          endPoint: ${{ vars.QA_AWS_ENDPOINT }}
          apiToken: ${{ secrets.QA_AWS_TOKEN }}

  deploy-resources-qa-aws-demo:
    runs-on: gitrunner
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Deploy Jobs using AAPI
        uses: harimunjala/controlm@v1.0.0-beta
        with:
          deployCommand: update_resources
          endPoint: ${{ vars.QA_AWS_ENDPOINT }}
          apiToken: ${{ secrets.QA_AWS_TOKEN }}

  deploy-connectionprofiles-qa-aws-demo:
    needs: deploy-secrets-qa-aws-demo
    runs-on: gitrunner
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Deploy Connection Profiles using AAPI
        uses: harimunjala/controlm@v1.0.0-beta
        with:
          deployCommand: update_cps
          endPoint: ${{ vars.QA_AWS_ENDPOINT }}
          apiToken: ${{ secrets.QA_AWS_TOKEN }}
          deployDescriptor: qa-aws-demo.json
          debugMode: true