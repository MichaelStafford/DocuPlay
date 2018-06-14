# DOCU-PLAY

## Setup Steps

  1. Login to DocuSign (https://account-d.docusign.com/) and go to admin
  2. Setup a Integrator
    - Go to Api and Keys tab
    - Add integrator key
    - Fill description and add
    - Place the integrator key inside your .env file (see example)
    - Create an RSA keypair, save the private key in a file called config/integratorRSA.key
  3. Get user to be impersonated
    - Go to user tab
    - Add User
    - Fill in email address (this will be who you will be impersonating)
    - Follow the user creation steps as you see fit
    - Once created click on the user and copy the API-Username, copy this to your .env file as impersonatedUserId (see example.env)

## Usage

  1. Install dependencies.

  ```Bash

    yarn

  ```

  2. Start the app by running.

  ```Bash

    yarn dev

  ```

  3. Send a post request to <http://localhost:8000> with a body of the form below.

  ```JSON

      {
        "id": 1,
        "url": "samples/pdf-sample-1.pdf",
        "signers": [
          {
            "id": 1,
            "email":"{someemail@something.com}",
            "name": "{Some Name}"
          }
        ],
        "tabs": [
          {
            "pageNumber": 1,
            "xPosition": 100,
            "yPosition": 100
          },
          {
            "pageNumber": 1,
            "xPosition": 200,
            "yPosition": 300
          }
        ]
      }
    ]

  ```

  4. The first request will fail due to no permission to impersonate, the terminal will output a URL. Go to it in a browser and follow the steps.

  5. Resend the request.