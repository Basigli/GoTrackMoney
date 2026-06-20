export const getApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    // If we're in the browser and the env URL is pointing to localhost,
    // intelligently rewrite it to the actual IP we are accessing from.
    if (!envUrl || envUrl.includes('localhost')) {
      return `http://${window.location.hostname}:8098`;
    }
  }
  return envUrl || 'http://localhost:8098';
};
export const API_BASE = getApiBase();
