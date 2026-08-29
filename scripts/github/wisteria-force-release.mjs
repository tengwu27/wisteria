const repository = process.env.GITHUB_REPOSITORY;
const githubToken = process.env.GITHUB_TOKEN;
const pullNumber = Number(process.env.WISTERIA_PULL_NUMBER);
const reason = process.env.WISTERIA_FORCE_RELEASE_REASON?.trim();
const confirmation = process.env.WISTERIA_FORCE_RELEASE_CONFIRMATION;

if (!repository || !githubToken || !Number.isInteger(pullNumber) || pullNumber < 1) {
  throw new Error('GitHub context and a valid pull-request number are required.');
}
if (!reason || confirmation !== 'RELEASE') {
  throw new Error('Force release requires a reason and exact RELEASE confirmation.');
}

const [owner, repo] = repository.split('/');
async function github(endpoint, options = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'wisteria-force-release',
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  if (response.status === 204) return undefined;
  return response.json();
}

const pull = await github(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
const marker = /<!--\s*wisteria-construction\s*([\s\S]*?)-->/i;
if (pull.state !== 'open' || !marker.test(String(pull.body ?? ''))) {
  throw new Error(`PR #${pullNumber} has no open Wisteria construction reservation.`);
}

await github(`/repos/${owner}/${repo}/issues/${pullNumber}/labels`, {
  method: 'POST',
  body: JSON.stringify({ labels: ['wisteria-force-released'] })
});
await github(`/repos/${owner}/${repo}/issues/${pullNumber}/comments`, {
  method: 'POST',
  body: JSON.stringify({
    body: `Wisteria reservation force-released by an explicit workflow invocation.\n\nReason: ${reason}\n\nThis PR remains open but must not continue construction without a new approved session.`
  })
});

console.log(`Force-released Wisteria reservation held by PR #${pullNumber}.`);
