import docusign from 'docusign-esign';
import path from 'path';

const NO_TOKEN_ERROR = 'No token was provided';

class DocusignAdapter {

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
    const { integratorKey, timeout, oAuthBaseUrl, integratorRSAKey, impersonatedUser } = this._config;

    return new Promise((resolve, reject) => {
      try {
        return this._apiClient.configureJWTAuthorizationFlow(
          integratorRSAKey,
          oAuthBaseUrl,
          integratorKey,
          impersonatedUser,
          timeout,
          (jwtError, jwtResponse) => {
            if (jwtError) {
              return reject(jwtError);
            } else {
              this._accessToken = jwtResponse.body.access_token;
              return resolve(jwtResponse);
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  _getUserDetails(accessToken) {
    if(!accessToken) {
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
      return this._getUserDetails(jwtResponse.body.access_token).then(userDetails => {
        const baseUri = userDetails.accounts[0].baseUri;
        const accountDomain = baseUri.split('/v2');
        this._apiClient.setBasePath(accountDomain[0] + "/restapi");

        return userDetails;
      });
    });
  }
}

export default DocusignAdapter;