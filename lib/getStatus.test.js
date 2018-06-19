import { perform } from './getStatus';
import docusignAdapter from './docusignAdapter';

jest.mock('./docusignAdapter', () => jest.fn());

const mockAuth = (authResponse, userRespone) => {
  docusignAdapter.mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(authResponse),
    getStatus: jest.fn().mockResolvedValue(userRespone)
  }));
};

const failureResponse = { code: 400, message: 'Ow God' };
const authSuccessResponse = { 
  accounts: [ { accountId: '1234', } ],
};
const statusSuccessResponse = {
  status: 'deleted',
};

beforeEach(() => {
  docusignAdapter.mockClear();
});

describe('authentication succeeds', () => {
  test('get status returns the status of the envelope', () => {
    mockAuth(authSuccessResponse, statusSuccessResponse);

    return perform().then(response => {
      expect(response).toEqual({"body": {"status": "deleted"}, "statusCode": 200});
    });
  });

  test('get status fails to return the status of the envelope', () => {
    mockAuth(authSuccessResponse, failureResponse);

    return perform().catch((error) => {
      expect(error).toBe({ statusCode: 400, body: response });
    });
  });
});

describe('authentication fails', () => {
  test('returns the error response correctly', () => {
    mockAuth(failureResponse, null);

    return perform().catch((error) => {
      expect(error).toBe({ statusCode: 400, body: response });
    });
  });
});