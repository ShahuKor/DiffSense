import { Octokit } from '@octokit/rest';
import { getFileContent } from '../../github/client';

export const readFileTool = {
  name: 'read_file',
  description: 'Fetch the full content of a file at the PR head commit SHA via GitHub API.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path relative to repo root' },
    },
    required: ['path'],
  },
} as const;

export async function readFile(
  input: { path: string },
  ctx: { octokit: Octokit; owner: string; repo: string; headSha: string }
): Promise<string> {
  return getFileContent(ctx.octokit, ctx.owner, ctx.repo, input.path, ctx.headSha);
}
