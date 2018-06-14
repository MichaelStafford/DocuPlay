import express from 'express';
import bodyparser from 'body-parser';
import fs from 'fs';
import path from 'path';
import docusign from 'docusign-esign';
import _ from 'lodash';
import moment from 'moment';
import { promisify } from 'util';

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
  integratorRSAKey: 'config/integratorRSAKey.key',
};

const apiClient = new docusign.ApiClient();
apiClient.setBasePath(config.baseUrl);
docusign.Configuration.default.setDefaultApiClient(apiClient); //Important

const docusignMiddleware = (req, res, next) => {
  
  console.log('Permission URL: ', apiClient.getJWTUri(
    config.integratorKey, 
    config.redirectUri, 
    config.oAuthBaseUrl
  ));
  
  apiClient.configureJWTAuthorizationFlow(
    path.resolve(__dirname, config.integratorRSAKey), 
    config.oAuthBaseUrl, 
    config.integratorKey, 
    config.impersonatedUser, 
    3600, 
    (err, response) => {
      if(err) {
        res.send(err);
      }
    
      apiClient.getUserInfo(response.body.access_token, (err, userInfo) => {
        if(err) {
          res.send(err);
        }
        
        req.accountId = userInfo.accounts[0].accountId;
        
        if(isProd) {
          const baseUri = userInfo.accounts[0].baseUri;
          const accountDomain = baseUri.split('/v2');
          apiClient.setBasePath(accountDomain[0] + "/restapi");
        }
        next();
      });
  });
}
app.use(docusignMiddleware);

const createDocument = (id, url) => {
  const docToSign = fs.readFileSync(path.resolve(__dirname, url)); // TODO This will probably be a fetch from a service.
  
  const doc = new docusign.Document();
  doc.name = 'Something.pdf'; // TODO what happens if we do not set a name
  doc.extension = 'pdf';      // TODO what happens if we do not set an extension
  doc.documentId = id;
  doc.documentBase64 = new Buffer.from(docToSign).toString('base64');

  return doc;
}

const createSigner = (signerData, tabs) => {
  const signer = new docusign.Signer();
  signer.email = signerData.email;
  signer.name = signerData.name;
  signer.recipientId = signerData.id;
  
  const signatureTabs = new docusign.Tabs();
  signatureTabs.tabs = tabs;
  signer.tabs = signatureTabs;
  
  return signer;
}

const createSignatureTab = (documentId, recipientId, tabData) => {
  const tab = new docusign.SignHere();
  tab.documentId = documentId;
  tab.recipientId = recipientId;
  
  tab.pageNumber = tabData.pageNumber;
  tab.xPosition = tabData.xPosition;
  tab.yPosition = tabData.yPosition;

  return tab;
}

const createEnvelopeDefinition = (documents, recipients) => {
  const definition = new docusign.EnvelopeDefinition();
  definition.emailSubject = 'Please sign this document';
  definition.documents = documents;
  definition.recipients = recipients;
  definition.status = 'sent'; // Otherwise it is treated as a draft

  return definition;
}

app.post('/', (req, res) => {
  const data = req.body;
  const recipients = new docusign.Recipients();
  recipients.signers = [];
   
  const documents = _.map(data, documentData => {
    const doc = createDocument(documentData.id, documentData.url)

    // TODO make actually work
    const tabs = _.map(documentData.tabs, tab => { 
      // TODO This likely needs to be integrated with the signers creation
      return createSignatureTab(documentData.id, documentData.signers[0].id, tab);
    });

    const signers =  _.map(documentData.signers, signerData => {
      const signer = createSigner(signerData, tabs); 
      
      // TODO remove side effects and basically all this code
      if(!_.find(recipients.signers, (existing) => existing.email == signer.email)) {
        recipients.signers.push(signer); 
      }

      return signer;
    });

    return doc;
  });

  const envelopeDefinition = createEnvelopeDefinition(documents, recipients);

  const accountId = req.accountId; //Gotten from the middleware
  
  const envelopesApi = new docusign.EnvelopesApi();
  envelopesApi.createEnvelope(accountId, {'envelopeDefinition': envelopeDefinition},
    (err, envelopeSummary, response) => {
      console.log(response);
      if (err) {
        res.send({err, response});
      } else {
        res.send(JSON.stringify(envelopeSummary));
      }
  });
});

const getEnvelope = (accountId, envelopeId, opts = {}) => {
  const api = new docusign.EnvelopesApi(apiClient);
  return new Promise((res, rej) => {
      api.getEnvelope(accountId, envelopeId, opts, (err, data) => {
        if(err) {
          return rej(err);
        } 
        res(data);
      })
  });
}

app.get('/envelopes/:envelopeId', (req, res) => {
  getEnvelope(req.accountId, req.params.envelopeId).then(response => {
    res.send(response);  
  }).catch(error => {
    res.status(error.status || 400).send(error.response); 
  });
});

app.get('/envelopes/:envelopeId/status', (req, res) => {
  getEnvelope(req.accountId, req.params.envelopeId).then(response => {
    res.send({status: response.status});  
  }).catch(error => {
    res.status(error.status || 400).send(error.response); 
  });
});

app.listen(8000, console.log('Goto http://localhost:8000'));