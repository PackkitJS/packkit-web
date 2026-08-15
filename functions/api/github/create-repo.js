// Create a new GitHub repo for the authenticated user and push the generated project.
//
// We push each file with the **Contents API** (one small PUT per file) rather than the Git
// Data tree API. From Cloudflare's edge, a `POST /git/trees` reliably 404s once the
// resulting tree exceeds ~12–14 entries (confirmed by probing: blobs and small trees
// return 201/200, a 15-entry tree 404s), and a scaffold has more root files than that. The
// Contents API never builds a big tree, so it just works — the trade-off is one commit per
// file instead of a single squashed commit.
//
// The token stays server-side (read from the httpOnly cookie) and is single-use.
import { parseCookies, gh, json, cookie } from './_lib.js';

// UTF-8-safe base64 for the Contents API (avoids btoa's Latin-1-only limitation and the
// call-stack blowup of spreading a large byte array).
function toBase64(str) {
	const bytes = new TextEncoder().encode(str);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

export async function onRequestPost({ request }) {
	const token = parseCookies(request).pk_gh_token;
	if (!token) return json({ error: 'not_connected' }, 401);

	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'bad_request' }, 400);
	}
	const { name, description = '', files } = payload || {};
	const isPrivate = !!payload?.private;
	if (!name || !/^[A-Za-z0-9._-]+$/.test(name)) return json({ error: 'invalid_name' }, 400);
	if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
		return json({ error: 'no_files' }, 400);
	}

	// 1. Create an empty repo — the first Contents PUT seeds the initial commit + branch,
	// so there's no auto-init README to reconcile.
	const created = await gh(token, '/user/repos', 'POST', {
		name,
		description,
		private: isPrivate,
		auto_init: false,
	});
	if (!created.ok) {
		const e = await created.json().catch(() => ({}));
		return json(
			{ error: e.errors?.[0]?.message || e.message || 'create_failed' },
			created.status === 422 ? 409 : 502,
		);
	}
	const repo = await created.json();
	const owner = repo.owner.login;
	const branch = repo.default_branch || 'main';

	// 2. PUT each file. Sequential — every PUT is a commit on the branch, so they can't race.
	// The first write may need a beat for the fresh repo to become writable, so retry it.
	const entries = Object.entries(files);
	for (let i = 0; i < entries.length; i++) {
		const [path, content] = entries[i];
		const url = `/repos/${owner}/${name}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
		const body = {
			message: i === 0 ? 'Initial commit from Packkit' : `Add ${path}`,
			content: toBase64(String(content ?? '')),
			branch,
		};
		let res = await gh(token, url, 'PUT', body);
		if (i === 0) {
			for (let a = 0; a < 12 && !res.ok && [404, 409].includes(res.status); a++) {
				await new Promise((r) => setTimeout(r, 700));
				res = await gh(token, url, 'PUT', body);
			}
		}
		if (!res.ok) {
			const e = await res.json().catch(() => ({}));
			return json(
				{ error: 'push_failed', detail: `${path}: ${e.message || res.status}`, html_url: repo.html_url },
				502,
			);
		}
	}

	return json({ html_url: repo.html_url, owner, name, branch, private: repo.private }, 201, {
		'Set-Cookie': cookie('pk_gh_token', '', { clear: true }),
	});
}
