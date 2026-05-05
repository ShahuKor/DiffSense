export interface PrReviewJobPayload {
  prId: string;
  repoFullName: string;
  prNumber: number;
  installationId: number;
  headSha: string;
}

export type CommentSeverity = 'CRITICAL' | 'SUGGESTION' | 'NITPICK';

export type ReviewVerdict = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';

export interface InlineComment {
  path: string;
  line: number;
  severity: CommentSeverity;
  body: string;
  confidence: number; // 0–1, comments below threshold are suppressed
}

export interface ReviewSummary {
  verdict: ReviewVerdict;
  summary: string;
  criticalIssues: string[];
}

export interface FileDiffHunk {
  header: string;
  additions: string[];
  deletions: string[];
  context: string[];
}

export interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  hunks: FileDiffHunk[];
}
