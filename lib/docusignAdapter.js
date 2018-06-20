import docusign from 'docusign-esign';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import moment from 'moment';
import qs from 'qs';
const NO_TOKEN_ERROR = 'No token was provided';

export default class DocusignAdapter {

  constructor(config) {
    this._config = config;
    this._apiClient = new docusign.ApiClient();
    this._apiClient.setBasePath(config.baseUrl);
  }

  authURI() {
    const { integratorKey, redirectUri, oAuthBaseUrl } = this._config;

    return this._apiClient.getJWTUri(integratorKey, redirectUri, oAuthBaseUrl);
  }

  _getAccessToken() {
    const { integratorKey, expiry, oAuthBaseUrl, oAuthEndpoint, integratorRSAKey, impersonatedUser } = this._config;

    const payload = {
      iss: integratorKey,
      sub: impersonatedUser,
      aud: oAuthBaseUrl,
      iat: moment().unix(),
      exp: moment().add(expiry, 'seconds').unix(),
      scope: 'signature impersonation'
    };

    const assertion = jwt.sign(payload, integratorRSAKey, { algorithm: 'RS256' });
    const data = qs.stringify({
      assertion: assertion,
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'
    });
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }

    return axios.post('https://' + oAuthBaseUrl + oAuthEndpoint, data, config).then(response => {
      this._accessToken = response.data.access_token;
      this._apiClient.addDefaultHeader('Authorization', `Bearer ${this._accessToken}`);  
      return response;
    });
  };

  _getUserDetails(accessToken) {
    if (!accessToken) {
      return new Promise((resolve, reject) => reject(NO_TOKEN_ERROR));
    }

    return new Promise((resolve, reject) => {
      try {
        this._apiClient.getUserInfo(accessToken, (error, userInfo) => {
          return error ? reject(error) : resolve(userInfo);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  authenticate() {
    return this._getAccessToken().then(jwtResponse => {
      return this._getUserDetails(jwtResponse.data.access_token).then(userDetails => {
        const baseUri = userDetails.accounts[0].baseUri;
        const accountDomain = baseUri.split('/v2');
        this._apiClient.setBasePath(accountDomain[0] + "/restapi");

        return userDetails;
      });
    });
  }

  getStatus(accountId, id, opts = {}) {
    return new Promise((resolve, reject) => {
      const api = new docusign.EnvelopesApi(this._apiClient);
      return api.getEnvelope(accountId, id, opts, (err, data) => {
        return err ? reject(err) : resolve(data);
      });
    });
  }
}