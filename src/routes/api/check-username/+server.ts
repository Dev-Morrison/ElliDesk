import type { RequestHandler } from './$types';
import { withLdapClient, searchDN, escapeLdapFilter } from '$lib/server/ldap';
import { requireCapability } from '$lib/server/permissions';

export const POST: RequestHandler = async ({ request, locals }) => {
  requireCapability(locals, 'users.manage');

  const { username } = await request.json();
  if (!username) return new Response('Missing username', { status: 400 });

  try {
    // Deliberately unscoped by domain: usernames must be unique across the
    // whole directory regardless of who's checking, so a restricted admin
    // still needs to know if a name collides with another domain's account.
    const available = await withLdapClient(async (client) => {
      const result = await client.search(searchDN(), {
        scope: 'sub',
        filter: `(sAMAccountName=${escapeLdapFilter(username)})`
      });

      return result.searchEntries.length === 0;
    });

    return new Response(JSON.stringify({ available }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ available: false, error: 'LDAP error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
