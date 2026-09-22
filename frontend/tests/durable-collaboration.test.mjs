import assert from 'node:assert/strict';
import test from 'node:test';

const collaboration = await import('../lib/durable-collaboration.ts').catch(
  () => ({}),
);

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('creates one stable browser device identifier', () => {
  const storage = memoryStorage();

  const first = collaboration.getOrCreateDeviceId?.(
    storage,
    () => 'uuid-1',
  );
  const second = collaboration.getOrCreateDeviceId?.(
    storage,
    () => 'uuid-2',
  );

  assert.equal(first, 'browser-uuid-1');
  assert.equal(second, first);
});

test('creates a browser device identifier when randomUUID is unavailable on HTTP', () => {
  const storage = memoryStorage();
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  try {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues(values) {
          values.fill(7);
          return values;
        },
      },
    });

    const deviceId = collaboration.getOrCreateDeviceId?.(storage);

    assert.match(deviceId, /^browser-[0-9a-f-]{36}$/);
    assert.equal(collaboration.getOrCreateDeviceId?.(storage), deviceId);
  } finally {
    if (cryptoDescriptor) {
      Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
    } else {
      delete globalThis.crypto;
    }
  }
});

test('allocates monotonic client sequences that survive recreation', () => {
  const storage = memoryStorage();

  assert.equal(collaboration.nextClientSequence?.(storage), 1);
  assert.equal(collaboration.nextClientSequence?.(storage), 2);
});

test('builds a full update with version and base snapshot', () => {
  const envelope = collaboration.createOperationEnvelope?.({
    diagramId: 'diagram-1',
    deviceId: 'browser-uuid-1',
    clientSequence: 7,
    baseVersion: 3,
    baseData: { classes: [], relations: [] },
    data: { classes: [{ id: 'class-1' }], relations: [] },
  });

  assert.deepEqual(envelope, {
    diagramId: 'diagram-1',
    deviceId: 'browser-uuid-1',
    clientSequence: 7,
    baseVersion: 3,
    baseData: { classes: [], relations: [] },
    changes: {
      type: 'full_update',
      data: { classes: [{ id: 'class-1' }], relations: [] },
    },
  });
});

test('remembers the latest confirmed server sequence per diagram', () => {
  const storage = memoryStorage();

  collaboration.rememberServerSequence?.(storage, 'diagram-1', 8);
  collaboration.rememberServerSequence?.(storage, 'diagram-1', 5);

  assert.equal(
    collaboration.getLastServerSequence?.(storage, 'diagram-1'),
    8,
  );
  assert.equal(
    collaboration.getLastServerSequence?.(storage, 'diagram-2'),
    0,
  );
});
