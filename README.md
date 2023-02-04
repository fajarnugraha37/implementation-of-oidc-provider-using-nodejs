# example setup of oidc-provider

By following this example you will set up an [oidc-provider](https://github.com/panva/node-oidc-provider)

### Install Dependencies
```bash
npm install
```

### Generate JWK keys
```bash
npm run generate:keys
```

### Running application
```bash
npm run start
```

### simulation
try to open htt://localhost:80/auth?client_id=foo&response_type=id_token&redirect_uri=https%3A%2F%2Fjwt.io&scope=openid%20email&nonce=foobar&prompt=login
enter foo@example.com or bar@example.com and any password

### NOTE
This is just a simple simulation with minimal configuration, NEVER USE it in production or real projects