import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function makeGraphqlResponse(
  overrides: {
    comments?: Array<{
      author?: string;
      createdAt: string;
      isMinimized?: boolean;
    }>;
    commits?: Array<{
      author?: string;
      authoredDate?: string;
      committedDate?: string;
    }>;
    createdAt?: string;
    prAuthor?: string;
    reviewThreads?: Array<{ isResolved: boolean }>;
    reviews?: Array<{
      author?: string;
      submittedAt?: string;
    }>;
  } = {},
) {
  const prAuthor = overrides.prAuthor ?? "sam";

  return {
    data: {
      repository: {
        pullRequest: {
          createdAt: overrides.createdAt ?? "2026-03-01T12:00:00Z",
          author: { login: prAuthor },
          comments: {
            nodes: (overrides.comments ?? []).map((comment) => ({
              author: comment.author ? { login: comment.author } : null,
              createdAt: comment.createdAt,
              isMinimized: comment.isMinimized ?? false,
            })),
          },
          reviews: {
            nodes: (overrides.reviews ?? []).map((review) => ({
              author: review.author ? { login: review.author } : null,
              submittedAt: review.submittedAt ?? null,
            })),
          },
          commits: {
            nodes: (overrides.commits ?? []).map((commit) => ({
              commit: {
                authoredDate: commit.authoredDate ?? null,
                committedDate: commit.committedDate ?? null,
                authors: {
                  nodes: commit.author
                    ? [{ user: { login: commit.author } }]
                    : [],
                },
              },
            })),
          },
          reviewThreads: {
            nodes: overrides.reviewThreads ?? [],
          },
        },
      },
    },
  };
}

async function runScript(
  scriptPath: string,
  args: string[],
  options: {
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<{ code: number | null; stderr: string; stdout: string }> {
  return await new Promise((resolveResult, reject) => {
    const child = spawn(scriptPath, args, {
      env: { ...process.env, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveResult({ code, stderr, stdout });
    });
  });
}

describe("check-pr-review.sh", () => {
  let tmpDir: string;
  let binDir: string;
  let repoDir: string;
  let graphqlResponsePath: string;
  let scriptPath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "check-pr-review-test-"));
    binDir = join(tmpDir, "bin");
    repoDir = join(tmpDir, "repo");
    graphqlResponsePath = join(tmpDir, "graphql-response.json");
    await mkdir(binDir, { recursive: true });
    await mkdir(repoDir, { recursive: true });

    await writeFile(
      join(binDir, "gh"),
      `#!/usr/bin/env bash
set -euo pipefail

if [ "$1" = "pr" ] && [ "$2" = "view" ]; then
  if [ "$4" = "--json" ] && [ "$5" = "state" ]; then
    printf '%s\\n' "\${GH_PR_STATE:-OPEN}"
    exit 0
  fi
  if [ "$4" = "--json" ] && [ "$5" = "reviewDecision" ]; then
    printf '%s\\n' "\${GH_REVIEW_DECISION:-REVIEW_REQUIRED}"
    exit 0
  fi
fi

if [ "$1" = "repo" ] && [ "$2" = "view" ]; then
  printf '%s\\n' "\${GH_REPO_NWO:-test/repo}"
  exit 0
fi

if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then
  cat "$GH_GRAPHQL_RESPONSE_FILE"
  exit 0
fi

if [ "$1" = "pr" ] && [ "$2" = "checks" ]; then
  printf '%s\\n' "\${GH_CI_FAILED:-0}"
  exit 0
fi

echo "Unexpected gh invocation: $*" >&2
exit 1
`,
      { mode: 0o755 },
    );
    scriptPath = resolve(
      dirname(new URL(import.meta.url).pathname),
      "../../scripts/check-pr-review.sh",
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function invokeCheckPrReview(
    response: ReturnType<typeof makeGraphqlResponse>,
    env: NodeJS.ProcessEnv = {},
  ) {
    await writeFile(graphqlResponsePath, JSON.stringify(response));

    return await runScript(scriptPath, [repoDir, "123"], {
      env: {
        GH_GRAPHQL_RESPONSE_FILE: graphqlResponsePath,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
        ...env,
      },
    });
  }

  it("treats a new non-author PR conversation comment as actionable", async () => {
    const result = await invokeCheckPrReview(
      makeGraphqlResponse({
        comments: [
          {
            author: "maintainer",
            createdAt: "2026-03-01T13:00:00Z",
          },
        ],
      }),
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("commented");
  });

  it("keeps waiting when the PR author already responded after a comment", async () => {
    const result = await invokeCheckPrReview(
      makeGraphqlResponse({
        comments: [
          {
            author: "maintainer",
            createdAt: "2026-03-01T13:00:00Z",
          },
          {
            author: "sam",
            createdAt: "2026-03-01T14:00:00Z",
          },
        ],
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stdout.trim()).toBe("");
  });

  it("treats PR-author follow-up commits as a response baseline", async () => {
    const result = await invokeCheckPrReview(
      makeGraphqlResponse({
        comments: [
          {
            author: "maintainer",
            createdAt: "2026-03-01T13:00:00Z",
          },
        ],
        commits: [
          {
            author: "sam",
            committedDate: "2026-03-01T14:00:00Z",
          },
        ],
      }),
    );

    expect(result.code).toBe(1);
    expect(result.stdout.trim()).toBe("");
  });

  it("preserves changes requested behavior", async () => {
    const result = await invokeCheckPrReview(makeGraphqlResponse(), {
      GH_REVIEW_DECISION: "CHANGES_REQUESTED",
    });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("changes_requested");
  });

  it("preserves CI failure behavior", async () => {
    const result = await invokeCheckPrReview(makeGraphqlResponse(), {
      GH_CI_FAILED: "2",
    });

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe("ci_failed");
  });
});
