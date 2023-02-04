// const assert = require('assert');
// const Provider = require('oidc-provider');
import assert from 'assert'
import Provider from 'oidc-provider'

const PROTOCOL = "http";
const HOSTNAME = "localhost";
const PORT = 80;
const SECURE_KEY = 'securekey,heroku-redis:hobby-dev'; 

// new Provider instance with no extra configuration, will run in default, just needs the issuer
// identifier, uses data from runtime-dyno-metadata heroku here
const oidc = new Provider(`${PROTOCOL}://${HOSTNAME}:${PORT}`, {
  clients: [
    {
      client_id: 'foo',
      redirect_uris: ['https://jwt.io'], // using jwt.io as redirect_uri to show the ID Token contents
      response_types: ['id_token'],
      grant_types: ['implicit'],
      token_endpoint_auth_method: 'none',
    },
  ],
  cookies: {
    keys: SECURE_KEY.split(','),
  },
});

// Heroku has a proxy in front that terminates ssl, you should trust the proxy.
oidc.proxy = true;

// listen on the heroku generated port
oidc.listen(PORT);
