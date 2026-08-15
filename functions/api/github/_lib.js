// Shared helpers for the GitHub OAuth "create + push repo" endpoints. Files prefixed
// with `_` are not routed by Cloudflare Pages, so this is a private module.

/** Parse the request Cookie header into a plain object. */
export function parseCookies(request) {
	const header = request.headers.get('cookie') || '';
	const out = {};
	for (const part of header.split(';')) {
		const i = part.indexOf('=');
		if (i === -1) continue;
		out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
	}
	return out;
}

/** Serialize a hardened cookie. `clear` expires it; otherwise Max-Age seconds (default 900). */
export function cookie(name, value, { maxAge = 900, clear = false } = {}) {
	return [
		`${name}=${clear ? '' : encodeURIComponent(value)}`,
		'Path=/',
		'HttpOnly',
		'Secure',
		'SameSite=Lax',
		`Max-Age=${clear ? 0 : maxAge}`,
	].join('; ');
}

/** JSON response with optional extra headers (e.g. Set-Cookie). */
export function json(body, status = 200, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers },
	});
}

/** The OAuth callback URL for this deployment (derived from the request origin). */
export const callbackUrl = (request) => `${new URL(request.url).origin}/api/github/callback`;

/** A GitHub REST API call with the standard headers. */
export function gh(token, path, method = 'GET', body) {
	return fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/vnd.github+json',
			'user-agent': 'packkit-web',
			'x-github-api-version': '2022-11-28',
			...(body ? { 'content-type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
}
