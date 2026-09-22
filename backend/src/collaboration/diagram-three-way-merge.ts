import { isDeepStrictEqual } from 'node:util';

type MergeResult = { ok: true; value: unknown } | { ok: false };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keyed(items: unknown[]): Map<string, Record<string, unknown>> | null {
  const result = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (!isObject(item) || typeof item.id !== 'string' || !item.id || result.has(item.id)) {
      return null;
    }
    result.set(item.id, item);
  }
  return result;
}

function mergeValue(base: unknown, local: unknown, remote: unknown): MergeResult {
  if (isDeepStrictEqual(local, remote)) return { ok: true, value: local };
  if (isDeepStrictEqual(local, base)) return { ok: true, value: remote };
  if (isDeepStrictEqual(remote, base)) return { ok: true, value: local };

  // A simultaneous addition with the same key, or delete versus edit, is ambiguous.
  if (base === undefined || local === undefined || remote === undefined) {
    return { ok: false };
  }

  if (isObject(base) && isObject(local) && isObject(remote)) {
    const merged: Record<string, unknown> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(remote), ...Object.keys(local)]);
    for (const key of keys) {
      const result = mergeValue(base[key], local[key], remote[key]);
      if (!result.ok) return result;
      if (result.value !== undefined) merged[key] = result.value;
    }
    return { ok: true, value: merged };
  }

  if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote)) {
    const baseMap = keyed(base);
    const localMap = keyed(local);
    const remoteMap = keyed(remote);
    if (!baseMap || !localMap || !remoteMap) return { ok: false };
    const ids = [...new Set([...remoteMap.keys(), ...localMap.keys(), ...baseMap.keys()])];
    const merged: unknown[] = [];
    for (const id of ids) {
      const result = mergeValue(baseMap.get(id), localMap.get(id), remoteMap.get(id));
      if (!result.ok) return result;
      if (result.value !== undefined) merged.push(result.value);
    }
    return { ok: true, value: merged };
  }

  return { ok: false };
}

export function mergeDiagram(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> | null {
  // Metadata contains volatile timestamps and actor labels, not model structure.
  // It must not turn otherwise independent edits into a structural conflict.
  const { metadata: _baseMetadata, ...baseStructure } = base;
  const { metadata: _localMetadata, ...localStructure } = local;
  const { metadata: remoteMetadata, ...remoteStructure } = remote;
  const result = mergeValue(baseStructure, localStructure, remoteStructure);
  if (!result.ok || !isObject(result.value)) return null;
  const merged = remoteMetadata === undefined
    ? result.value
    : { ...result.value, metadata: remoteMetadata };
  if (!Array.isArray(merged.classes) || !Array.isArray(merged.relations)) return null;
  const classes = keyed(merged.classes);
  const relations = keyed(merged.relations);
  if (!classes || !relations) return null;
  for (const relation of relations.values()) {
    const source = relation.sourceClassId ?? relation.source;
    const target = relation.targetClassId ?? relation.target;
    if (typeof source !== 'string' || typeof target !== 'string' ||
      !classes.has(source) || !classes.has(target)) {
      return null;
    }
  }
  return merged;
}
