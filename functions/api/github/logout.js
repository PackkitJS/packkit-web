// Forget the stored GitHub token.
import { cookie, json } from './_lib.js';

export function onRequestPost() {
	return json({ ok: true }, 200, { 'Set-Cookie': cookie('pk_gh_token', '', { clear: true }) });
}
