interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEVICE_KEY = 'uml_collaboration_device_id';
const SEQUENCE_KEY = 'uml_collaboration_client_sequence';
const serverSequenceKey = (diagramId: string) =>
  `uml_collaboration_server_sequence:${diagramId}`;

const createCompatibleUuid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
};

export const getOrCreateDeviceId = (
  storage: StorageLike,
  createId: () => string = createCompatibleUuid,
): string => {
  const existing = storage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = `browser-${createId()}`;
  storage.setItem(DEVICE_KEY, created);
  return created;
};

export const nextClientSequence = (storage: StorageLike): number => {
  const current = Number.parseInt(storage.getItem(SEQUENCE_KEY) ?? '0', 10);
  const next = (Number.isFinite(current) && current >= 0 ? current : 0) + 1;
  storage.setItem(SEQUENCE_KEY, String(next));
  return next;
};

export const createOperationEnvelope = ({
  diagramId,
  deviceId,
  clientSequence,
  baseVersion,
  baseData,
  data,
}: {
  diagramId: string;
  deviceId: string;
  clientSequence: number;
  baseVersion: number;
  baseData: Record<string, unknown>;
  data: Record<string, unknown>;
}) => ({
  diagramId,
  deviceId,
  clientSequence,
  baseVersion,
  baseData,
  changes: { type: 'full_update' as const, data },
});

export const getLastServerSequence = (
  storage: StorageLike,
  diagramId: string,
): number => {
  const value = Number.parseInt(storage.getItem(serverSequenceKey(diagramId)) ?? '0', 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
};

export const rememberServerSequence = (
  storage: StorageLike,
  diagramId: string,
  sequence: number,
): void => {
  const current = getLastServerSequence(storage, diagramId);
  if (Number.isInteger(sequence) && sequence > current) {
    storage.setItem(serverSequenceKey(diagramId), String(sequence));
  }
};
