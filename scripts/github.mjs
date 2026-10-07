const API = "https://api.github.com";

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

export async function rest(token, path) {
  return request(token, `${API}/${path}`);
}

export async function graphql(token, query, variables = {}) {
  const body = await request(token, `${API}/graphql`, { method: "POST", body: JSON.stringify({ query, variables }) });
  return body.data;
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
