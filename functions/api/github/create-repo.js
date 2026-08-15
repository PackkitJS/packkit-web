// Create a new GitHub repo for the authenticated user and push the generated project as a
// single initial commit — via the Git Data API (tree → commit → ref), so the whole
// scaffold lands in one commit with no per-file churn. The token stays server-side (read
// from the httpOnly cookie) and is single-use: cleared after a successful push.
import { parseCookies, gh, json, cookie } from './_lib.js';

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

	// 1. Create the repo. `auto_init` seeds it with a commit so the Git Data API has
	// something to work against — a *truly* empty repo rejects tree creation (409).
	const created = await gh(token, '/user/repos', 'POST', {
		name,
		description,
		private: isPrivate,
		auto_init: true,
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
	const base = `/repos/${owner}/${name}/git`;
	const fail = async (code, res) => {
		const e = await res.json().catch(() => ({}));
		return json({ error: code, detail: e.message, html_url: repo.html_url }, 502);
	};

	// A brand-new repo needs a beat before its git backend is writable — wait until it's
	// readable, then push.
	for (let i = 0; i < 15; i++) {
		const rr = await gh(token, `${base}/trees/${branch}`);
		if (rr.ok) break;
		await new Promise((res) => setTimeout(res, 700));
	}

	// Create a BLOB per file, then build the tree from blob SHAs — NOT one big tree with
	// every file's content inline. A large inline-content tree POST intermittently 404s
	// (oversized request body over the edge→GitHub hop), whereas each small blob write and
	// the resulting SHA-only tree succeed.
	let tree;
	try {
		tree = await Promise.all(
			Object.entries(files).map(async ([path, content]) => {
				const b = await gh(token, `${base}/blobs`, 'POST', {
					content: String(content ?? ''),
					encoding: 'utf-8',
				});
				if (!b.ok) throw new Error(`${path}: HTTP ${b.status}`);
				return { path, mode: '100644', type: 'blob', sha: (await b.json()).sha };
			}),
		);
	} catch (e) {
		return json({ error: 'blob_failed', detail: e.message, html_url: repo.html_url }, 502);
	}
	// Build the tree in small batches, chaining via base_tree — a single tree POST with all
	// entries at once 404s on the edge→GitHub hop, while few-entry writes succeed.
	let treeSha;
	for (let i = 0; i < tree.length; i += 5) {
		const batch = tree.slice(i, i + 5);
		const tr = await gh(
			token,
			`${base}/trees`,
			'POST',
			treeSha ? { base_tree: treeSha, tree: batch } : { tree: batch },
		);
		if (!tr.ok) {
			const e = await tr.json().catch(() => ({}));
			return json(
				{ error: 'tree_failed', detail: `batch@${i} n=${batch.length} cum=${i + batch.length}: ${e.message || tr.status}`, html_url: repo.html_url },
				502,
			);
		}
		treeSha = (await tr.json()).sha;
	}

	// 3. A single orphan commit (no parents) — so history is exactly one clean initial
	// commit, not the auto-init README followed by ours.
	const commitRes = await gh(token, `${base}/commits`, 'POST', {
		message: 'Initial commit from Packkit',
		tree: treeSha,
		parents: [],
	});
	if (!commitRes.ok) return fail('commit_failed', commitRes);
	const commitSha = (await commitRes.json()).sha;

	// 4. Force the default branch onto our commit (the auto-init commit is orphaned).
	const refRes = await gh(token, `${base}/refs/heads/${branch}`, 'PATCH', {
		sha: commitSha,
		force: true,
	});
	if (!refRes.ok) return fail('ref_failed', refRes);

	return json({ html_url: repo.html_url, owner, name, branch, private: repo.private }, 201, {
		'Set-Cookie': cookie('pk_gh_token', '', { clear: true }),
	});
}
