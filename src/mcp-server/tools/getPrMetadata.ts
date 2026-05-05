import { Octokit } from '@octokit/rest';

export const getPrMetadataTool = {
  name: 'get_pr_metadata',
  description: 'Get PR title, description, author, base branch, and labels.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
} as const;

export async function getPrMetadata(
  _input: Record<string, never>,
  ctx: { octokit: Octokit; owner: string; repo: string; prNumber: number }
): Promise<{
  title: string;
  body: string | null;
  author: string;
  baseBranch: string;
  labels: string[];
}> {
  const { data } = await ctx.octokit.pulls.get({
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
  });

  return {
    title: data.title,
    body: data.body,
    author: data.user?.login ?? 'unknown',
    baseBranch: data.base.ref,
    labels: data.labels.map((l) => l.name ?? ''),
  };
}
