import "server-only";

import { Octokit } from "octokit";

import {
  imagePath,
  parsePost,
  postPath,
  publicImageUrl,
  serializePost,
} from "./serialize";
import type { Frontmatter } from "./schema";
import {
  ContentError,
  type ContentAdapter,
  type InvalidPost,
  type ListResult,
  type Post,
  type PostMeta,
  type UploadResult,
  type WriteResult,
} from "./types";

const POSTS_DIR = "content/posts";
const IMAGES_DIR = "public/images";
const FILE_MODE = "100644" as const;

interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

let cachedConfig: GitHubConfig | null = null;

export function getGitHubConfig(): GitHubConfig {
  if (cachedConfig) return cachedConfig;

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  const missing = [
    !token && "GITHUB_TOKEN",
    !owner && "GITHUB_OWNER",
    !repo && "GITHUB_REPO",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new ContentError(
      `GitHub content adapter is not configured. Missing: ${missing.join(", ")}.`,
      500,
    );
  }

  cachedConfig = { token: token!, owner: owner!, repo: repo!, branch };
  return cachedConfig;
}

export function isGitHubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN &&
    process.env.GITHUB_OWNER &&
    process.env.GITHUB_REPO,
  );
}

let cachedClient: Octokit | null = null;

function client(): Octokit {
  if (!cachedClient) {
    cachedClient = new Octokit({
      auth: getGitHubConfig().token,
      userAgent: "alfism-blog-cms",
      request: { timeout: 15_000 },
    });
  }
  return cachedClient;
}

interface OctokitLikeError {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string | undefined> };
}

/** Map Octokit failures onto messages an admin can actually act on. */
function toContentError(error: unknown, context: string): ContentError {
  if (error instanceof ContentError) return error;

  const err = error as OctokitLikeError;
  const status = err.status ?? 500;
  const remaining = err.response?.headers?.["x-ratelimit-remaining"];

  if ((status === 403 || status === 429) && remaining === "0") {
    const reset = err.response?.headers?.["x-ratelimit-reset"];
    const when = reset
      ? new Date(Number(reset) * 1000).toLocaleTimeString()
      : "shortly";
    return new ContentError(
      `GitHub API rate limit exceeded. Try again after ${when}.`,
      429,
      error,
    );
  }

  if (status === 401) {
    return new ContentError(
      "GitHub rejected the token. Check that GITHUB_TOKEN is valid and not expired.",
      401,
      error,
    );
  }

  if (status === 403) {
    return new ContentError(
      "GitHub denied the request. The token needs `Contents: Read and write` on this repository.",
      403,
      error,
    );
  }

  if (status === 404) {
    return new ContentError(
      `${context}: not found on GitHub. Check GITHUB_OWNER, GITHUB_REPO and GITHUB_BRANCH.`,
      404,
      error,
    );
  }

  if (status === 409) {
    return new ContentError(
      "The repository changed while saving. Reload the post and try again.",
      409,
      error,
    );
  }

  return new ContentError(
    `${context}: ${err.message ?? "unexpected GitHub API error"}`,
    status >= 400 && status < 600 ? status : 500,
    error,
  );
}

// --- Reads -----------------------------------------------------------------

interface TreeQueryResult {
  repository: {
    object: {
      entries: Array<{
        name: string;
        type: string;
        object: { text: string | null; isBinary: boolean | null } | null;
      }>;
    } | null;
  } | null;
}

/**
 * Fetch every post in one request via GraphQL.
 *
 * The REST equivalent costs one call per file, which burns through the rate
 * limit during a build and makes cold admin loads slow. GraphQL returns the
 * whole directory — names *and* blob text — in a single round trip.
 */
async function listViaGraphQL(): Promise<Array<{
  name: string;
  text: string;
}> | null> {
  const { owner, repo, branch } = getGitHubConfig();
  try {
    const data = await client().graphql<TreeQueryResult>(
      `query ($owner: String!, $repo: String!, $expression: String!) {
        repository(owner: $owner, name: $repo) {
          object(expression: $expression) {
            ... on Tree {
              entries {
                name
                type
                object { ... on Blob { text isBinary } }
              }
            }
          }
        }
      }`,
      { owner, repo, expression: `${branch}:${POSTS_DIR}` },
    );

    const entries = data.repository?.object?.entries;
    // A missing directory means "no posts yet", which is a valid empty blog.
    if (!entries) return [];

    return entries
      .filter(
        (entry) =>
          entry.type === "blob" &&
          entry.name.endsWith(".mdx") &&
          typeof entry.object?.text === "string",
      )
      .map((entry) => ({ name: entry.name, text: entry.object!.text! }));
  } catch {
    // GraphQL can be unavailable to some token types — let the caller fall back.
    return null;
  }
}

async function listViaRest(): Promise<Array<{ name: string; text: string }>> {
  const { owner, repo, branch } = getGitHubConfig();
  const octokit = client();

  let filenames: string[];
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: POSTS_DIR,
      ref: branch,
    });
    if (!Array.isArray(data)) {
      throw new ContentError(`${POSTS_DIR} is not a directory`, 500);
    }
    filenames = data
      .filter((entry) => entry.type === "file" && entry.name.endsWith(".mdx"))
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as OctokitLikeError).status === 404) return [];
    throw toContentError(error, "Listing posts");
  }

  return Promise.all(
    filenames.map(async (name) => ({
      name,
      text: await getRawFile(`${POSTS_DIR}/${name}`),
    })),
  );
}

async function getRawFile(path: string): Promise<string> {
  const { owner, repo, branch } = getGitHubConfig();
  const { data } = await client().rest.repos.getContent({
    owner,
    repo,
    path,
    ref: branch,
  });
  if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
    throw new ContentError(`${path} is not a file`, 500);
  }
  return Buffer.from(data.content, "base64").toString("utf8");
}

// --- Atomic commits --------------------------------------------------------

export type Change =
  | { kind: "upsert-text"; path: string; content: string }
  | { kind: "upsert-binary"; path: string; data: Buffer }
  | { kind: "delete"; path: string };

/**
 * Apply a set of file changes as a **single commit** using the Git Data API.
 *
 * `createOrUpdateFileContents` can only touch one file per call, which would
 * mean a rename (write new + delete old) produces two commits and therefore two
 * Vercel deploys. Building the tree by hand keeps every admin action to exactly
 * one commit and one deploy.
 */
async function commitChanges(
  changes: Change[],
  message: string,
): Promise<string> {
  if (changes.length === 0) {
    throw new ContentError("No changes to commit", 400);
  }

  const { owner, repo, branch } = getGitHubConfig();
  const octokit = client();

  try {
    const { data: ref } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const headSha = ref.object.sha;

    const { data: headCommit } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: headSha,
    });

    const tree = await Promise.all(
      changes.map(async (change) => {
        if (change.kind === "delete") {
          return {
            path: change.path,
            mode: FILE_MODE,
            type: "blob" as const,
            sha: null,
          };
        }

        if (change.kind === "upsert-text") {
          return {
            path: change.path,
            mode: FILE_MODE,
            type: "blob" as const,
            content: change.content,
          };
        }

        // Binary content must go through the blob API — the tree `content`
        // field is UTF-8 only and would corrupt image bytes.
        const { data: blob } = await octokit.rest.git.createBlob({
          owner,
          repo,
          content: change.data.toString("base64"),
          encoding: "base64",
        });
        return {
          path: change.path,
          mode: FILE_MODE,
          type: "blob" as const,
          sha: blob.sha,
        };
      }),
    );

    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: headCommit.tree.sha,
      tree,
    });

    const { data: commit } = await octokit.rest.git.createCommit({
      owner,
      repo,
      message,
      tree: newTree.sha,
      parents: [headSha],
    });

    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.sha,
    });

    return commit.sha;
  } catch (error) {
    throw toContentError(error, "Committing to GitHub");
  }
}

async function fileExists(path: string): Promise<boolean> {
  const { owner, repo, branch } = getGitHubConfig();
  try {
    await client().rest.repos.getContent({ owner, repo, path, ref: branch });
    return true;
  } catch (error) {
    if ((error as OctokitLikeError).status === 404) return false;
    throw toContentError(error, `Checking ${path}`);
  }
}

/** Every blob path under a directory, used to delete a post's image folder. */
async function listDirectoryPaths(dir: string): Promise<string[]> {
  const { owner, repo, branch } = getGitHubConfig();
  try {
    const { data } = await client().rest.repos.getContent({
      owner,
      repo,
      path: dir,
      ref: branch,
    });
    if (!Array.isArray(data)) return [];
    return data
      .filter((entry) => entry.type === "file")
      .map((entry) => entry.path);
  } catch (error) {
    if ((error as OctokitLikeError).status === 404) return [];
    throw toContentError(error, `Listing ${dir}`);
  }
}

// --- Adapter ---------------------------------------------------------------

export const githubApiAdapter: ContentAdapter = {
  name: "github-api",
  triggersDeploy: true,

  async list(): Promise<ListResult> {
    const files = (await listViaGraphQL()) ?? (await listViaRest());

    const posts: PostMeta[] = [];
    const invalid: InvalidPost[] = [];

    for (const file of files) {
      const relative = `${POSTS_DIR}/${file.name}`;
      try {
        const post = parsePost(
          file.text,
          relative,
          file.name.replace(/\.mdx$/, ""),
        );
        const { body: _body, ...meta } = post;
        void _body;
        posts.push(meta);
      } catch (error) {
        invalid.push({ path: relative, error: (error as Error).message });
      }
    }

    return { posts, invalid };
  },

  async get(slug: string): Promise<Post | null> {
    try {
      const source = await getRawFile(postPath(slug, POSTS_DIR));
      return parsePost(source, postPath(slug, POSTS_DIR), slug);
    } catch (error) {
      if ((error as OctokitLikeError).status === 404) return null;
      throw toContentError(error, `Reading post "${slug}"`);
    }
  },

  async create(post: {
    frontmatter: Frontmatter;
    body: string;
  }): Promise<WriteResult> {
    const slug = post.frontmatter.slug;
    const path = postPath(slug, POSTS_DIR);

    if (await fileExists(path)) {
      throw new ContentError(
        `A post with the slug "${slug}" already exists`,
        409,
      );
    }

    const commitSha = await commitChanges(
      [{ kind: "upsert-text", path, content: serializePost(post) }],
      `content: add post "${post.frontmatter.title}"`,
    );

    return { slug, commitSha, triggersDeploy: true };
  },

  async update(
    previousSlug: string,
    post: { frontmatter: Frontmatter; body: string },
  ): Promise<WriteResult> {
    const nextSlug = post.frontmatter.slug;
    const previousPath = postPath(previousSlug, POSTS_DIR);
    const nextPath = postPath(nextSlug, POSTS_DIR);
    const renamed = nextSlug !== previousSlug;

    if (!(await fileExists(previousPath))) {
      throw new ContentError(
        `No post found with the slug "${previousSlug}"`,
        404,
      );
    }
    if (renamed && (await fileExists(nextPath))) {
      throw new ContentError(
        `Cannot rename: a post with the slug "${nextSlug}" already exists`,
        409,
      );
    }

    const changes: Change[] = [
      { kind: "upsert-text", path: nextPath, content: serializePost(post) },
    ];
    if (renamed) changes.push({ kind: "delete", path: previousPath });

    const commitSha = await commitChanges(
      changes,
      renamed
        ? `content: rename "${previousSlug}" to "${nextSlug}"`
        : `content: update post "${post.frontmatter.title}"`,
    );

    return { slug: nextSlug, commitSha, triggersDeploy: true };
  },

  async remove(
    slug: string,
    options: { deleteImages?: boolean } = {},
  ): Promise<WriteResult> {
    const path = postPath(slug, POSTS_DIR);
    if (!(await fileExists(path))) {
      throw new ContentError(`No post found with the slug "${slug}"`, 404);
    }

    const changes: Change[] = [{ kind: "delete", path }];

    if (options.deleteImages) {
      const imagePaths = await listDirectoryPaths(`${IMAGES_DIR}/${slug}`);
      for (const imageFile of imagePaths) {
        changes.push({ kind: "delete", path: imageFile });
      }
    }

    const commitSha = await commitChanges(
      changes,
      `content: delete post "${slug}"`,
    );

    return { slug, commitSha, triggersDeploy: true };
  },

  async uploadImage({
    slug,
    filename,
    data,
  }: {
    slug: string;
    filename: string;
    data: Buffer;
  }): Promise<UploadResult> {
    const path = imagePath(slug, filename);
    const commitSha = await commitChanges(
      [{ kind: "upsert-binary", path, data }],
      `content: upload image ${filename} for "${slug}"`,
    );
    return {
      path: publicImageUrl(slug, filename),
      commitSha,
      triggersDeploy: true,
    };
  },
};
