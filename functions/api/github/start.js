// Kick off the GitHub OAuth flow: set a CSRF state cookie and redirect to GitHub's
// authorize page. The `repo` scope lets the user create public or private repos.
import { cookie, callbackUrl } from './_lib.js';

export function onRequestGet({ request, env }) {
	if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
		return new Response('GitHub OAuth is not configured on this deployment.', { status: 501 });
	}
	const state = crypto.randomUUID();
	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
	authorize.searchParams.set('redirect_uri', callbackUrl(request));
	authorize.searchParams.set('scope', 'repo');
	authorize.searchParams.set('state', state);
	return new Response(null, {
		status: 302,
		headers: {
			Location: authorize.toString(),
			'Set-Cookie': cookie('pk_oauth_state', state, { maxAge: 600 }),
		},
	});
}
