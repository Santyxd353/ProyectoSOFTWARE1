const FEATURE_FILES: Record<string, string[]> = {
  HEALTH_ENDPOINT: ['controller/HealthController.java'],
  REQUEST_LOGGING: ['config/RequestLoggingFilter.java'],
  API_DOCUMENTATION: ['API_DOCUMENTATION.md'],
};

export function refinementFiles(feature: string): string[] {
  return FEATURE_FILES[feature] ?? [];
}

export function toggleRefinementFeature(selected: string[], feature: string): string[] {
  return selected.includes(feature)
    ? selected.filter((item) => item !== feature)
    : [...selected, feature];
}
