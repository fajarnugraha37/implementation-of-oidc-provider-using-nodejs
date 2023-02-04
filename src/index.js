import assert from 'assert'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import bodyParser from 'body-parser'
import Provider from 'oidc-provider'
import RedisAdapter from './redis_adapter.js'
import Account from './account.js'
import jwks from './jwks.json' assert { type: 'json' }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROTOCOL = "http";
const HOSTNAME = "localhost";
const PORT = 80;
const SECURE_KEY = 'is secret,do not tell anyone,ok'; 

const oidc = new Provider(`${PROTOCOL}://${HOSTNAME}:${PORT}`, {
  adapter: RedisAdapter,
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
  jwks,

  findAccount: Account.findAccount,

  claims: {
    openid: ['sub'],
    email: ['email', 'email_verified'],
  },

  interactions: {
    url(ctx, interaction) {
      return `/interaction/${interaction.uid}`;
    },
  },
  features: {
    // disable the packaged interactions
    devInteractions: { enabled: false },
  },
});

oidc.proxy = true;

const expressApp = express();
expressApp.set('trust proxy', true);
expressApp.set('view engine', 'ejs');
expressApp.set('views', path.resolve(__dirname, 'views'));

const parse = bodyParser.urlencoded({ extended: false });

function setNoCache(req, res, next) {
  res.set('Pragma', 'no-cache');
  res.set('Cache-Control', 'no-cache, no-store');
  next();
}
expressApp.use((req, res, next) => {
  console.log('cookie', req.cookies);
  next();
})

expressApp.get('/interaction/:uid', setNoCache, async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    console.log('see what else is available to you for interaction views', details);
    const {
      uid, prompt, params,
    } = details;

    const client = await oidc.Client.find(params.client_id);
    console.log('see what else is available to you for interaction views', details);

    if (prompt.name === 'login') {
      return res.render('login', {
        client,
        uid,
        details: prompt.details,
        params,
        title: 'Sign-in',
        flash: undefined,
      });
    }

    return res.render('interaction', {
      client,
      uid,
      details: prompt.details,
      params,
      title: 'Authorize',
    });
  } catch (err) {
    console.error('error', err);
    return next(err);
  }
});

expressApp.post('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
  try {
    const { uid, prompt, params } = await oidc.interactionDetails(req, res);
    assert.strictEqual(prompt.name, 'login');
    const client = await oidc.Client.find(params.client_id);

    const accountId = await Account.authenticate(req.body.email, req.body.password);

    if (!accountId) {
      res.render('login', {
        client,
        uid,
        details: prompt.details,
        params: {
          ...params,
          login_hint: req.body.email,
        },
        title: 'Sign-in',
        flash: 'Invalid email or password.',
      });
      return;
    }

    const result = {
      login: { accountId },
    };

    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
  } catch (err) {
    next(err);
  }
});

expressApp.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
  try {
    const interactionDetails = await oidc.interactionDetails(req, res);
    const { prompt: { name, details }, params, session: { accountId } } = interactionDetails;
    assert.strictEqual(name, 'consent');

    let { grantId } = interactionDetails;
    let grant;

    if (grantId) {
      grant = await oidc.Grant.find(grantId);
    } else {
      grant = new oidc.Grant({
        accountId,
        clientId: params.client_id,
      });
    }

    if (details.missingOIDCScope) {
      grant.addOIDCScope(details.missingOIDCScope.join(' '));
    }
    if (details.missingOIDCClaims) {
      grant.addOIDCClaims(details.missingOIDCClaims);
    }
    if (details.missingResourceScopes) {
      for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
        grant.addResourceScope(indicator, scopes.join(' '));
      }
    }

    grantId = await grant.save();

    const consent = {};
    if (!interactionDetails.grantId) {
      consent.grantId = grantId;
    }

    const result = { consent };
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
  } catch (err) {
    next(err);
  }
});

expressApp.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
  try {
    const result = {
      error: 'access_denied',
      error_description: 'End-User aborted interaction',
    };
    await oidc.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
  } catch (err) {
    next(err);
  }
});

expressApp.use(oidc.callback());

expressApp.listen(PORT);