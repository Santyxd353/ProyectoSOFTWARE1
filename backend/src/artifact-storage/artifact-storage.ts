export interface ArtifactStorage {
  put(key: string, bytes: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');
