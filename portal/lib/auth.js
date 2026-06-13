// Single-tenant token auth: the actor and you share PORTAL_API_TOKEN.
export function requireToken(req) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!process.env.PORTAL_API_TOKEN || token !== process.env.PORTAL_API_TOKEN) {
    return false;
  }
  return true;
}
