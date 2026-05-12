export const REVIEW_QUEUE_NAME = 'pr-review';

export const MAX_FILES_DEEP_REVIEW = 8;

export const CONFIDENCE_THRESHOLD = 0.7;

export const EMBEDDING_DIMENSIONS = 1536;

export const CLAUDE_MODEL = 'claude-sonnet-4-5';

export const GITHUB_EVENTS = {
  PULL_REQUEST: 'pull_request',
  PR_REVIEW_COMMENT: 'pull_request_review_comment',
} as const;

export const PULL_REQUEST_ACTIONS = ['opened', 'synchronize', 'reopened'] as const;
