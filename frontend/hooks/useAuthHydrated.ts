import { useSyncExternalStore } from 'react';
import { useAuthStore } from '@/stores/auth';

const subscribe = (onStoreChange: () => void) =>
  useAuthStore.persist.onFinishHydration(onStoreChange);

const getSnapshot = () => useAuthStore.persist.hasHydrated();
const getServerSnapshot = () => false;

export function useAuthHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
