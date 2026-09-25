export const getApiBase = () => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== 'undefined') {
    if (envUrl) {
      // Preserve the configured port and path when accessing a local server over LAN.
      const url = new URL(envUrl);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        url.hostname = window.location.hostname;
      }
      return url.toString().replace(/\/$/, '');
    }
    return `${window.location.protocol}//${window.location.hostname}:8098`;
  }
  return envUrl || 'http://localhost:8098';
};
export const API_BASE = getApiBase();
