import express from 'express';
import bodyparser from 'body-parser';
import fs from 'fs';
import path from 'path';
import docusign from 'docusign-esign';
import _ from 'lodash';

import docusignAdapter from './lib/docusign-adapter';

const app = express();
app.use(bodyparser.json());
app.use(express.static(path.join(__dirname, 'public')))

const isProd = process.env.production === true; 
const config = {
  baseUrl: 'https://demo.docusign.net/restapi',     //Probably wont be this is prod
  oAuthBaseUrl: isProd ? 'account.docusign.com' : 'account-d.docusign.com', 
  oAuthEndpoint: '/oath/token',
  redirectUri: 'https://www.docusign.com',          // Ignore for now, we do not care if we are automated
  integratorKey: process.env.clientID,              // We setup an integrator on the admin console
  impersonatedUser: process.env.impersonatedUserID, // This could be any user theoretically
  integratorRSAKey: path.resolve(__dirname, 'config/integratorRSAKey.key'),
  timeout: 3600,
};

const adapter = new docusignAdapter(config);
const apiClient = adapter._apiClient;


const docusignMiddleware = (req, res, next) => {
  console.log('Permission URL: ', adapter.authURI());
  return adapter.authenticate().then(response => {
    req.accountId = response.accounts[0].accountId;
    next();
  }).catch(error => {
    next(error.response, null);
  });
}

app.use(docusignMiddleware);

const createDocuments = (documentData) => {
  return _.map(documentData, ({ url }, key) => {
    return docusign.Document.constructFromObject({
      documentId: key,
      name: 'Some Document Name',
      documentBase64: new Buffer.from(fs.readFileSync(path.resolve(__dirname, url))).toString('base64'),  
    });
  });
};

const createSigners = (documentData, signerData) => {
  return _.map(signerData, ({ email, name, phone}, recipientId) => {
    const smsAuthentication = phone ? docusign.RecipientSMSAuthentication.constructFromObject({
      senderProvidedNumbers: [phone],
      recipMayProvideNumber: false,
    }) : null; //  I do not think this is available at this time
    
    const tabs = createTabs(recipientId, documentData);

    return docusign.Signer.constructFromObject({
      recipientId,
      email,
      name,
      smsAuthentication,
      tabs,
    });
  });
}

const createTabs = (recipientId, documentData) => {
  const signHereTabs = _.map(documentData, ({ tabs }, documentId) => {
    const signatures = _.filter(tabs.signatures, ({signerIds}) => _.includes(signerIds, recipientId));
    return createSignatures(documentId, recipientId, signatures) 
  }); 

  return docusign.Tabs.constructFromObject({
    signHereTabs: _.flatten(signHereTabs),
  });
}

const createSignatures = (documentId, recipientId, signatures) => {
  return _.map(signatures, ({ pageNumber, xPosition, yPosition }) => {
    return docusign.SignHere.constructFromObject({
      documentId,
      pageNumber,
      xPosition,
      yPosition,
      recipientId,
    });
  });
}

const createViewers = (viewers) => {
  return _.map(viewers, ({ email, name }, recipientId) => {
    return docusign.CarbonCopy.constructFromObject({
      recipientId,
      email,
      name,
    });
  }); 
}

const createEnvelope = (accountId, envelopeData) => {
  const documentData = envelopeData.documents;
  const signerData = envelopeData.recipients.signers;
  const viewerData = envelopeData.recipients.viewers;

  return new Promise((resolve, reject) => {
    const documents = createDocuments(documentData);   
    const signers = createSigners(documentData, signerData);
    const carbonCopies = createViewers(viewerData); // I do not think this is available at this time

    const recipients = docusign.Recipients.constructFromObject({
      signers, 
      carbonCopies,
    });

    const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
      emailSubject: '[[Signer _UserName]] Please sign this!',
      status: 'sent', 
      brandId: '9fef7cc9-b11f-4e7e-8387-937a06107830', 
      documents: documents,
      recipients: recipients,
    });  
    
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    envelopesApi.createEnvelope(accountId, { envelopeDefinition: envelopeDefinition },
      (err, summary, response) => { 
      return err ? reject({ err, response }) : resolve({summary, response});
      }
    );
  });
}

const getEnvelope = (accountId, envelopeId, opts = {}) => {
  return new Promise((resolve, reject) => {
    const api = new docusign.EnvelopesApi(apiClient);
    api.getEnvelope(accountId, envelopeId, opts, (err, data) => {
        return err ? reject(err) : resolve(data);
      });
  });
}

app.post('/envelopes', (req, res) => {
  createEnvelope(req.accountId, req.body).then(({summary}) => {
    res.send(summary);
  }).catch(error => {
    res.status(error.status || 400).send(error.response);
  });
});

app.get('/envelopes/:envelopeId', (req, res) => {
  getEnvelope(req.accountId, req.params.envelopeId).then(response => {
    res.send(response);  
  }).catch(error => {
    res.status(error.status || 400).send(error.response); 
  });
});

app.get('/envelopes/:envelopeId/status', (req, res) => {
  getEnvelope(req.accountId, req.params.envelopeId).then(({status}) => {
    res.send({status});  
  }).catch(error => {
    res.status(error.status || 400).send(error.response); 
  });
});

app.listen(8000, console.log('Goto http://localhost:8000'));