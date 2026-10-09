// GitHub API helper. Uses the robot's token on GitHub, or the local gh login on this Mac.
import { execFileSync } from 'node:child_process';

const token = process.env.GH_READ_TOKEN || process.env.GITHUB_TOKEN || (() => { try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim(); } catch { return ''; } })();
// On GitHub without a read token, the private repos are invisible, so skip fetching and keep the cached numbers.
const offline = process.env.CI && !process.env.GH_READ_TOKEN;
export const api = async (path) => {
  if (offline) throw new Error('no read token');
  const r = await fetch(`https://api.github.com/${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
};
