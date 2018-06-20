import DocusignAdapter from './docusignAdapter';
import config from './config';

const createResponse = (statusCode, body) => ({ statusCode, body, });

export function perform(event, context) {
  const adapter = new DocusignAdapter(config);
  
  return adapter.authenticate().then(userDetails => {
    return adapter.getStatus(userDetails.accounts[0].accountId, 'c0a58373-7a15-4d90-afd5-913a541d925c').then(response => {
      return createResponse(200, { status: response.status });
    }).catch(error => {
      return createResponse(400, { code: error.code, message: error.message });
    });
  }).catch(error => {
    return createResponse(400, { code: error.code, message: error.message });
  });
}
