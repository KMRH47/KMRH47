export function summarize(days, featured) {
  const byRepo = new Map();
  const activeDays = new Set();
  for (const { repo, date, commits } of days) {
    byRepo.set(repo, (byRepo.get(repo) ?? 0) + commits);
    activeDays.add(date.toISOString().slice(0, 10));
  }
  const ranked = [...byRepo]
    .map(([repo, commits]) => ({ name: repo.split("/")[1], commits }))
    .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  if (ranked.length === 0) throw new Error("no public commits in the window");
  const rest = ranked.slice(featured);
  return {
    total: ranked.reduce((sum, repo) => sum + repo.commits, 0),
    activeDays: activeDays.size,
    top: ranked.slice(0, featured),
    rest: { repos: rest.length, commits: rest.reduce((sum, repo) => sum + repo.commits, 0) },
  };
}
