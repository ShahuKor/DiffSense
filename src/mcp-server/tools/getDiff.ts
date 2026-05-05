import { Octokit } from '@octokit/rest';
import { getPrFiles, parsePatch } from '../../github/client';
import { FileDiff } from '../../shared/types';

export const getDiffTool = {
  name: 'get_diff',
  description: 'Return structured diff for a specific file: hunks with additions, deletions, and context lines.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to get the diff for' },
    },
    required: ['path'],
  },
} as const;

export async function getDiff(
  input: { path: string },
  ctx: { octokit: Octokit; owner: string; repo: string; prNumber: number }
): Promise<FileDiff> {
  const files = await getPrFiles(ctx.octokit, ctx.owner, ctx.repo, ctx.prNumber);
  const file = files.find((f) => f.filename === input.path);

  if (!file) throw new Error(`File not found in PR diff: ${input.path}`);

  return {
    path: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    hunks: file.patch ? parsePatch(file.patch) : [],
  };
}
