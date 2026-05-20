import type { Env } from './types';

// Cloudflare Access strips inbound copies of these headers and re-adds them
// after authenticating a request. So when the worker route is fronted by Access,
// the header is trustworthy. If Access is NOT configured on the route, anyone
// can spoof the email and impersonate any user — make sure your wrangler routes
// or custom domain are inside an Access application before going live.
export function getUserEmail(req: Request, env: Env): string | null {
  const header = req.headers.get('Cf-Access-Authenticated-User-Email');
  if (header) return header.toLowerCase();
  if (env.DEV_USER_EMAIL) return env.DEV_USER_EMAIL.toLowerCase();
  return null;
}
