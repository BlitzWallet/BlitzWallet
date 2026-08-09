/* eslint-env jest */
// C-9 — customUUID must never fail open to a falsy id. A falsy id collides every
// caller on pendingRequests[false] (earlier resolvers orphaned) and the falsy-id
// response is dropped at `content.isResponse && content.id`. It must throw.

let mockRandomBytes;
jest.mock('react-native-quick-crypto', () => ({
  randomBytes: (...a) => mockRandomBytes(...a),
}));

const customUUID = require('../../app/functions/customUUID').default;

describe('customUUID', () => {
  test('returns a non-empty hex id on success', () => {
    mockRandomBytes = () => Buffer.alloc(32, 1);
    const id = customUUID();
    expect(typeof id).toBe('string');
    expect(id.length).toBe(16);
  });

  test('throws (never returns a falsy id) when entropy fails', () => {
    mockRandomBytes = () => {
      throw new Error('no entropy');
    };
    expect(() => customUUID()).toThrow();
  });
});
