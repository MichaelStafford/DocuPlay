import docusignAdapter from './docusignAdapter';

import docusign from 'docusign-esign';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import qs from 'qs';

jest.mock('docusign-esign');
jest.mock('axios');
jest.mock('jsonwebtoken');

const config = {
  integratorKey: 'ABC-123',
  redirectUri: 'http://www.test.com',
  oAuthBaseUrl: 'test-account.docusign.com',
  impersonatedUser: 'me',
  timeout: 3600,
  integratorRSAKey: 'some key',
}

const fakejwt = '123';

let adapter;
beforeEach(() => {
  jest.resetAllMocks();
  adapter = new docusignAdapter(config);
  jwt.sign.mockReturnValue(fakejwt);
});

test('the docusign adapter recieves and stores a config', () => {
  expect(adapter._config).toEqual(config);
});

test('the docusign adapter creates an API Client on initialisation', () => {
  const adapter = new docusignAdapter({}); 
  
  expect(adapter._apiClient).not.toBeNull();
});

test('the docusign adapter sets the baseUrl for the API Client', () => {
  const basePathMock = docusign.ApiClient.instance.setBasePath.mock; 
  expect(basePathMock.calls.length).toBe(1);
  expect(basePathMock.calls[0][0]).toEqual(config.baseUrl);
});

describe('Authentication', () => {
  const fakeToken = 'some fake token'; 
  const fakeAccessTokenResponse = { data: { access_token: fakeToken  } };
  const accessTokenErrorResponse = { status: 400, error: 'Ow god, ow god.' };
  const fakeAccount = { accountId: '123', baseUri: '/someEndpoint' }; 
  const fakeUserDetailsResponse = { accounts: [ fakeAccount, { } ] };
  const userDetailsErrorResponse = { status: 400, error: 'Danger Will Robinson.' };

  const mockApiClient = docusign.ApiClient.instance; 
  
  const mockAccessToken = (error, success) => {
    if(error) {
      return axios.post.mockRejectedValue(error)
    } else {
      return axios.post.mockResolvedValue(success)
    }
  }

  const mockUserDetails = (error, success) => {
    const userMock = mockApiClient.getUserInfo
    userMock.mockImplementationOnce((accessToken, cb) => (cb(error, success)));
   
    return userMock;
  }

  test('get JWT Uri success', () => {
    const fakeJWTUriResponse = 'Some URI';
    mockApiClient.getJWTUri.mockReturnValue(fakeJWTUriResponse);
   
    const uri = adapter.authURI();

    expect(uri).toEqual(fakeJWTUriResponse);
    const calls = mockApiClient.getJWTUri.mock.calls; 
    
    
    expect(calls[0][0]).toEqual(config.integratorKey);
    expect(calls[0][1]).toEqual(config.redirectUri);
    expect(calls[0][2]).toEqual(config.oAuthBaseUrl);
  });

  test('get access_token success', () => {
    const tokenMock = mockAccessToken(null, fakeAccessTokenResponse);
    
    return adapter._getAccessToken().then((response) => {
      expect(response).toBe(fakeAccessTokenResponse);
      expect(adapter._accessToken).toBe(fakeToken);

      const expectedData = qs.stringify({
        assertion: fakejwt,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
      });
      const expectedConfig = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }

      const calls = tokenMock.mock.calls;
      expect(calls[0][0]).toEqual(`https://${config.oAuthBaseUrl}${config.oAuthEndpoint}`);
      expect(calls[0][1]).toEqual(expectedData);
      expect(calls[0][2]).toEqual(expectedConfig);
    });
  });

  test('get access_token failure', () => {
    mockAccessToken(accessTokenErrorResponse, null);    
    
    return adapter._getAccessToken().catch(error => {
      expect(error).toBe(accessTokenErrorResponse);
    });
  });

  test('get user details success with access_token', () => {
    const userDetailsMock = mockUserDetails(null, fakeUserDetailsResponse);

    return adapter._getUserDetails(fakeToken).then(response => {
      expect(response).toEqual(fakeUserDetailsResponse);
      
      const calls = userDetailsMock.mock.calls;
      expect(calls[0][0]).toBe(fakeToken);
      expect(typeof calls[0][1]).toBe('function');
    });
  });

  test('get user details failure without access_token', () => {
    return adapter._getUserDetails(null).catch(error => {
      expect(error).toEqual('No token was provided');
    });
  });

  test('get user details failure', () => {
    mockUserDetails(userDetailsErrorResponse, null); 
 
    return adapter._getUserDetails(fakeToken).catch(error => {
      expect(error).toBe(userDetailsErrorResponse);
    }); 
  });

  test('authenticate gets an access token and returns the users accountId', () => {
    mockAccessToken(null, fakeAccessTokenResponse);    
    mockUserDetails(null, fakeUserDetailsResponse); 

    return adapter.authenticate().then(response => {
      expect(response).toBe(fakeUserDetailsResponse);
    });
  });

  test('authenticate fails due to the access token request', () => {
    mockAccessToken(accessTokenErrorResponse, null);

    return adapter.authenticate().catch(error => {
      expect(error).toBe(accessTokenErrorResponse);
    });
  });

  test('authenticate fails due to the user details call', () => {
    mockAccessToken(null, fakeAccessTokenResponse);
    mockUserDetails(userDetailsErrorResponse, null); 
    
    return adapter.authenticate().catch(error => {
      expect(error).toBe(userDetailsErrorResponse);
    });
  });

});