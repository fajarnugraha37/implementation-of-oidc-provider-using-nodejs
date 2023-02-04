import Redis from 'ioredis'
import isEmpty from 'lodash/isEmpty.js'

const REDIS_URL = "0.0.0.0:6379";
const client = new Redis(REDIS_URL, { keyPrefix: 'oidc:', password: 'root' });

const grantable = new Set([
  'AccessToken',
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

const consumable = new Set([
  'AuthorizationCode',
  'RefreshToken',
  'DeviceCode',
  'BackchannelAuthenticationRequest',
]);

function grantKeyFor(id) {
  console.log(this.name, arguments);
  return `grant:${id}`;
}

function userCodeKeyFor(userCode) {
  console.log(this.name, arguments);
  return `userCode:${userCode}`;
}

function uidKeyFor(uid) {
  console.log(this.name, arguments);
  return `uid:${uid}`;
}

export default class RedisAdapter {
  constructor(name) {
    this.name = name;
  }

  async upsert(id, payload, expiresIn) {
    console.log(this.name, arguments);
    const key = this.key(id);
    const store = consumable.has(this.name)
      ? { payload: JSON.stringify(payload) } : JSON.stringify(payload);

    const multi = client.multi();
    multi[consumable.has(this.name) ? 'hmset' : 'set'](key, store);

    if (expiresIn) {
      multi.expire(key, expiresIn);
    }

    if (grantable.has(this.name) && payload.grantId) {
      const grantKey = grantKeyFor(payload.grantId);
      multi.rpush(grantKey, key);
      const ttl = await client.ttl(grantKey);
      if (expiresIn > ttl) {
        multi.expire(grantKey, expiresIn);
      }
    }

    if (payload.userCode) {
      const userCodeKey = userCodeKeyFor(payload.userCode);
      multi.set(userCodeKey, id);
      multi.expire(userCodeKey, expiresIn);
    }

    if (payload.uid) {
      const uidKey = uidKeyFor(payload.uid);
      multi.set(uidKey, id);
      multi.expire(uidKey, expiresIn);
    }

    await multi.exec();
  }

  async find(id) {
    console.log(this.name, arguments);
    const data = consumable.has(this.name)
      ? await client.hgetall(this.key(id))
      : await client.get(this.key(id));

    if (isEmpty(data)) {
      return undefined;
    }

    if (typeof data === 'string') {
      return JSON.parse(data);
    }
    const { payload, ...rest } = data;
    return {
      ...rest,
      ...JSON.parse(payload),
    };
  }

  async findByUid(uid) {
    console.log(this.name, arguments);
    const id = await client.get(uidKeyFor(uid));
    return this.find(id);
  }

  async findByUserCode(userCode) {
    console.log(this.name, arguments);
    const id = await client.get(userCodeKeyFor(userCode));
    return this.find(id);
  }

  async destroy(id) {
    console.log(this.name, arguments);
    const key = this.key(id);
    await client.del(key);
  }

  async revokeByGrantId(grantId) { 
    console.log(this.name, arguments);
    const multi = client.multi();
    const tokens = await client.lrange(grantKeyFor(grantId), 0, -1);
    tokens.forEach((token) => multi.del(token));
    multi.del(grantKeyFor(grantId));
    await multi.exec();
  }

  async consume(id) {
    console.log(this.name, arguments);
    await client.hset(this.key(id), 'consumed', Math.floor(Date.now() / 1000));
  }

  key(id) {
    console.log(this.name, arguments);
    return `${this.name}:${id}`;
  }
}