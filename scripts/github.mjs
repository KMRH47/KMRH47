const ENDPOINT = "https://api.github.com/graphql";
const WINDOW_DAYS = 91;
const DAY_MS = 86_400_000;

const QUERY = `
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

async function graphql(token, variables) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables }),
  });
  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(`GitHub GraphQL ${response.status}: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.data.user.contributionsCollection;
}

export async function publicCommitDays(token, login, from, to) {
  const days = [];
  for (let start = from.getTime(); start < to.getTime(); start += WINDOW_DAYS * DAY_MS) {
    const end = Math.min(start + WINDOW_DAYS * DAY_MS, to.getTime());
    const collection = await graphql(token, {
      login,
      from: new Date(start).toISOString(),
      to: new Date(end - 1).toISOString(),
    });
    for (const { repository, contributions } of collection.commitContributionsByRepository) {
      if (repository.isPrivate) continue;
      for (const { occurredAt, commitCount } of contributions.nodes) {
        days.push({ repo: repository.nameWithOwner, date: new Date(occurredAt), commits: commitCount });
      }
    }
  }
  return days;
}
