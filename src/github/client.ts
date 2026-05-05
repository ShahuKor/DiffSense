import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { FileDiff, FileDiffHunk } from '../shared/types';

let appInstance: App | null = null;

function getApp(): App {
  if (!appInstance) {
    const privateKey = process.env.GITHUB_PRIVATE_KEY!.replace(/\\n/g, '\n');
    appInstance = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey,
      webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET! },
    });
  }
  return appInstance;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const app = getApp();
  return app.getInstallationOctokit(installationId) as unknown as Octokit;
}

export async function getPrFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<{ filename: string; additions: number; deletions: number; patch?: string }[]> {
  const { data } = await octokit.pulls.listFiles({ owner, repo, pull_number: prNumber, per_page: 100 });
  return data.map((f) => ({
    filename: f.filename,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}

export async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string> {
  const { data } = await octokit.repos.getContent({ owner, repo, path, ref });
  if ('content' in data && typeof data.content === 'string') {
    return Buffer.from(data.content, 'base64').toString('utf-8');
  }
  throw new Error(`Path ${path} is not a file`);
}

export function parsePatch(patch: string): FileDiff['hunks'] {
  const hunks: FileDiffHunk[] = [];
  let current: FileDiffHunk | null = null;

  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: line, additions: [], deletions: [], context: [] };
    } else if (current) {
      if (line.startsWith('+')) current.additions.push(line.slice(1));
      else if (line.startsWith('-')) current.deletions.push(line.slice(1));
      else current.context.push(line.slice(1));
    }
  }
  if (current) hunks.push(current);
  return hunks;
}

export async function postInlineComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  commitId: string,
  path: string,
  line: number,
  body: string
): Promise<void> {
  await octokit.pulls.createReviewComment({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: commitId,
    path,
    line,
    body,
  });
}

export async function postPrReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  commitId: string,
  body: string,
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
): Promise<void> {
  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: prNumber,
    commit_id: commitId,
    body,
    event,
  });
}

export async function getFileCommitHistory(
  octokit: Octokit,
  owner: string,
  repo: string,
  path: string,
  limit = 10
): Promise<{ sha: string; message: string; date: string }[]> {
  const { data } = await octokit.repos.listCommits({ owner, repo, path, per_page: limit });
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    date: c.commit.author?.date ?? '',
  }));
}
