import test from 'node:test';
import assert from 'node:assert/strict';
import {createSafeStore} from '../src/lib/storage.js';

test('read, write and remove return verified storage results', () => {
  const records = new Map();
  const storage = {
    getItem(key) { return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { records.set(key,value); },
    removeItem(key) { records.delete(key); }
  };
  const store = createSafeStore(() => storage);
  assert.equal(store.get('a'),null);
  assert.equal(store.set('a','value'),true);
  assert.equal(store.get('a'),'value');
  assert.equal(store.remove('a'),true);
  assert.equal(store.get('a'),null);
});
test('disallowed storage consistently reports unsuccessful writes and erasure', () => {
  const store = createSafeStore(() => {throw new Error('storage disabled');});
  assert.equal(store.get('private'),null);
  assert.equal(store.set('private','value'),false);
  assert.equal(store.remove('private'),false);
});
test('write errors never present as successful saves', () => {
  const store = createSafeStore(() => ({
    getItem(){return null;},
    setItem(){throw new Error('QuotaExceededError');},
    removeItem(){throw new Error('SecurityError');}
  }));
  assert.equal(store.set('a','place'),false);
  assert.equal(store.remove('a'),false);
});
