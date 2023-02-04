import { LowSync, MemorySync } from 'lowdb'
import assert from 'assert'

const adapter = new MemorySync();
const db = new LowSync(adapter);

db.data ||= { users: [] }  

db.data.users.push(
  {
    id: '23121d3c-84df-44ac-b458-3d63a9a05497',
    email: 'foo@example.com',
    password: 'foo@example.com',
    email_verified: true,
  },
  {
    id: 'c2ac2b4a-2262-4e2f-847a-a40dd3c4dcd5',
    email: 'bar@example.com',
    password: 'bar@example.com',
    email_verified: false,
  },
)
db.write()

export default class Account {
  static async findAccount(ctx, id) {
    const account = adapter.read().find(value => value.id == id);
    if (!account) {
      return undefined;
    }

    return {
      accountId: id,
      async claims() {
        return {
          sub: id,
          email: account.email,
          email_verified: account.email_verified,
        };
      },
    };
  }

  static async authenticate(email, password) {
    try {
      assert(password, 'password must be provided');
      assert(email, 'email must be provided');
      const lowercased = String(email).toLowerCase();
      console.log({
        data: adapter.read().users
      });
      const account = adapter.read().users.find(value => value.email == lowercased);
      assert(account, 'invalid credentials provided');

      return account.id;
    } catch (err) {
      console.log(err, email, password);
      return undefined;
    }
  }
}