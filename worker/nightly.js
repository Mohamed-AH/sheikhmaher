// Nightly alarm: GitHub's own schedule sometimes skips a night, so this Worker, on a Cloudflare cron,
// asks GitHub to run the "Refresh catalog and deploy" workflow — the same as pressing "Run workflow".
// It does no crawling itself. Secret GH_TOKEN: a fine-grained token for this repo with Actions: read and write.
export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(start(env));
  },
};

async function start(env) {
  const repo = env.REPO || 'Mohamed-AH/sheikhmaher';
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/site.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sheikhmaher-nightly-alarm',
    },
    body: JSON.stringify({ ref: 'main' }),
  });
  // 204 means GitHub accepted it; anything else shows in the Worker's logs
  if (r.status !== 204) throw new Error(`GitHub answered ${r.status}: ${await r.text()}`);
  console.log('nightly refresh started');
}
