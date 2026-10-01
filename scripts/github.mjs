const API = "https://api.github.com";
const WINDOW_DAYS = 91;
const DAY_MS = 86_400_000;

async function request(token, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(`GitHub ${response.status} ${url}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body;
}

async function graphql(token, query, variables = {}) {
  const body = await request(token, `${API}/graphql`, { method: "POST", body: JSON.stringify({ query, variables }) });
  return body.data;
}

const COMMITS = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository { nameWithOwner isPrivate }
          contributions(first: 100) { nodes { occurredAt commitCount } }
        }
      }
    }
  }`;

export async function publicCommitDays(token, login, from, to) {
  const days = [];
  for (let start = from.getTime(); start < to.getTime(); start += WINDOW_DAYS * DAY_MS) {
    const end = Math.min(start + WINDOW_DAYS * DAY_MS, to.getTime());
    const data = await graphql(token, COMMITS, {
      login,
      from: new Date(start).toISOString(),
      to: new Date(end - 1).toISOString(),
    });
    for (const { repository, contributions } of data.user.contributionsCollection.commitContributionsByRepository) {
      if (repository.isPrivate) continue;
      for (const { occurredAt, commitCount } of contributions.nodes) {
        days.push({ repo: repository.nameWithOwner, date: new Date(occurredAt), commits: commitCount });
      }
    }
  }
  return days;
}

export async function stars(token, repos) {
  const fields = repos
    .map((repo, index) => {
      const [owner, name] = repo.split("/");
      return `r${index}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { stargazerCount }`;
    })
    .join("\n");
  const data = await graphql(token, `query {\n${fields}\n}`);
  return new Map(repos.map((repo, index) => [repo, data[`r${index}`].stargazerCount]));
}

export async function latestRelease(token, repo, prefix) {
  const releases = await request(token, `${API}/repos/${repo}/releases?per_page=100`);
  const release = releases.find((entry) => !entry.draft && !entry.prerelease && entry.tag_name.startsWith(prefix));
  if (!release) throw new Error(`${repo} has no ${prefix}* release`);
  return release.tag_name.slice(prefix.length);
}
