export type ProtectedRouteState = 'pending' | 'redirect' | 'ready';

export function protectedRouteState(
  hasHydrated: boolean,
  user: unknown,
): ProtectedRouteState {
  if (!hasHydrated) return 'pending';
  return user ? 'ready' : 'redirect';
}
