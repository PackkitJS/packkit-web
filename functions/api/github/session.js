// Report whether the browser has a live GitHub token (httpOnly, so JS can't read it
// directly) and, if so, which user — the app uses this to skip re-auth and label the button.
import { parseCookies, gh, json } from './_lib.js';

export async function onRequestGet({ request }) {
	const token = parseCookies(request).pk_gh_token;
	if (!token) return json({ connected: false });
	const res = await gh(token, '/user');
	if (!res.ok) return json({ connected: false });
	const user = await res.json();
	return json({ connected: true, login: user.login });
}
