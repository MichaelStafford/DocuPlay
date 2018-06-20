# DOCU-PLAY

## Setup Steps

  1. Login to DocuSign (https://account-d.docusign.com/) and go to admin
  2. Setup a Integrator
    - Go to Api and Keys tab
    - Add integrator key
    - Fill description and add
    - Place the integrator key inside your .env file (see example)
    - Create an RSA keypair, save the private key in the env variable integratorRSAKey.

  3. Get user to be impersonated
    - Go to user tab
    - Add User
    - Fill in email address (this will be who you will be impersonating)
    - Follow the user creation steps as you see fit
    - Once created click on the user and copy the API-Username, copy this to your .env file as impersonatedUser (see example.env)

  4. Fill all variables in the example.env

## Usage

  1. Install dependencies.

  ```Bash

    yarn setup

  ```

  2. Start the app by running.

  ```Bash

    yarn dev

  ```

  3. Send a get request to localhost:3000/status
 

  4. The first request will fail due to no permission to impersonate, the terminal will output a URL. Go to it in a browser and follow the steps.

  5. Resend the request.