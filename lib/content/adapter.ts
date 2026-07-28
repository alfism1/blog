import "server-only";

import { githubApiAdapter, isGitHubConfigured } from "./github-api-adapter";
import { localFsAdapter } from "./local-fs-adapter";
import type { ContentAdapter } from "./types";

export type { ContentAdapter } from "./types";
export { ContentError } from "./types";

/**
 * Which storage backend is active.
 *
 * Vercel's serverless filesystem is **read-only and ephemeral**, so a write to
 * `content/posts/*.mdx` in production would appear to succeed and then vanish on
 * the next cold start. Production therefore always routes through the GitHub
 * REST API, which commits to the repo and lets Vercel's Git integration
 * redeploy. Local development uses the filesystem for a fast edit loop.
 *
 * Override with `CONTENT_SOURCE=local|github` when you need to test the GitHub
 * path locally (or run a self-hosted deployment off a writable disk).
 */
export function resolveAdapterName(): "local-fs" | "github-api" {
  const override = process.env.CONTENT_SOURCE?.toLowerCase();
  if (override === "local") return "local-fs";
  if (override === "github") return "github-api";
  return process.env.NODE_ENV === "production" && isGitHubConfigured()
    ? "github-api"
    : "local-fs";
}

export function getContentAdapter(): ContentAdapter {
  return resolveAdapterName() === "github-api"
    ? githubApiAdapter
    : localFsAdapter;
}

/**
 * True when writes land in Git and trigger a real deploy — the admin UI uses
 * this to decide between "Saved" and "Pushed, live in ~1 minute".
 */
export function writesTriggerDeploy(): boolean {
  return getContentAdapter().triggersDeploy;
}
