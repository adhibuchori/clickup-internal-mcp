/**
 * Where the server may send a request. The API host is fixed in the adapter; images are downloaded
 * only over HTTPS from ClickUp's own hosts plus any suffix the user adds in CLICKUP_ASSET_HOSTS. A
 * redirect is checked again at every hop, so a link cannot bounce the download somewhere else.
 */
const CLICKUP_HOSTS = ['clickup.com', 'clickup-attachments.com', 'clickupusercontent.com'];

function matches(host: string, suffix: string): boolean {
  const clean = suffix.trim().toLowerCase().replace(/^\.+/, '');
  return clean.length > 0 && (host === clean || host.endsWith(`.${clean}`));
}

export function isAllowedAssetUrl(url: string, extraSuffixes: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return [...CLICKUP_HOSTS, ...extraSuffixes].some((suffix) => matches(host, suffix));
}

/** ClickUp's own hosts may receive the token on a download; a user-added host never does. */
export function mayCarryToken(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return CLICKUP_HOSTS.some((suffix) => matches(host, suffix));
  } catch {
    return false;
  }
}
