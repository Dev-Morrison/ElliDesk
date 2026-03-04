import type { RequestHandler } from './$types';
import { Client } from 'ldapts';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  const { username } = await request.json();
  if (!username) return new Response('Missing username', { status: 400 });

  const client = new Client({
    url: env.LDAP_URL,
  });

  try {
    await client.bind(env.LDAP_SERVICE_USER_DN, env.LDAP_SERVICE_PASSWORD);

    const result = await client.search(env.LDAP_SEARCH_DN, {
      scope: 'sub',
      filter: `(sAMAccountName=${username})`
    });

    await client.unbind();

    return new Response(
      JSON.stringify({ available: result.searchEntries.length === 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ available: false, error: 'LDAP error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};