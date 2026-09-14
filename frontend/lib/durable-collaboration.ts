interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const DEVICE_KEY = 'uml_collaboration_device_id';
const SEQUENCE_KEY = 'uml_collaboration_client_sequence';
const serverSequenceKey = (diagramId: string) =>
  `uml_collaboration_server_sequence:${diagramId}`;

export const getOrCreateDeviceId = (
  storage: StorageLike,
  createId: () => string = () => crypto.randomUUID(),
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
