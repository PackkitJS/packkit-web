// GitHub redirects here with ?code&state. Verify the state (CSRF), exchange the code for
// an access token server-side (the client secret never leaves the server), stash the
// token in a short-lived httpOnly cookie, and bounce back to the app.
import { parseCookies, cookie, callbackUrl } from './_lib.js';

export async function onRequestGet({ request, env }) {
	const url = new URL(request.url);
	const origin = url.origin;
	const back = (status) => Response.redirect(`${origin}/?github=${status}`, 302);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const saved = parseCookies(request).pk_oauth_state;
	if (!code || !state || !saved || state !== saved) return back('error');

	const res = await fetch('https://github.com/login/oauth/access_token', {
		method: 'POST',
		headers: { 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: callbackUrl(request),
		}),
	});
	const data = await res.json().catch(() => ({}));
	if (!data.access_token) return back('error');

	const headers = new Headers({ Location: `${origin}/?github=connected` });
	headers.append('Set-Cookie', cookie('pk_gh_token', data.access_token, { maxAge: 900 }));
	headers.append('Set-Cookie', cookie('pk_oauth_state', '', { clear: true }));
	return new Response(null, { status: 302, headers });
}
