import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/site.config";

/**
 * Known AI / generative-engine crawlers.
 *
 * Allowing these is a deliberate GEO choice (§12): it lets AI assistants read,
 * summarise and *cite* the blog. To opt out of AI training or answer engines,
 * move a user-agent from `AI_CRAWLERS` to `BLOCKED_AI_CRAWLERS` below — no other
 * change is needed.
 */
const AI_CRAWLERS = [
  "GPTBot", // OpenAI — training + browsing
  "OAI-SearchBot", // OpenAI — ChatGPT search index
  "ChatGPT-User", // OpenAI — user-initiated fetches
  "ClaudeBot", // Anthropic — crawling
  "Claude-User", // Anthropic — user-initiated fetches
  "Claude-SearchBot", // Anthropic — search index
  "PerplexityBot", // Perplexity — index
  "Perplexity-User", // Perplexity — user-initiated fetches
  "Google-Extended", // Google — Gemini / Vertex AI grounding
  "Applebot-Extended", // Apple Intelligence
  "meta-externalagent", // Meta AI
  "Bytespider", // ByteDance / Doubao
  "cohere-ai", // Cohere
  "DuckAssistBot", // DuckDuckGo AI assist
];

/** Move entries here to deny a specific AI crawler. */
const BLOCKED_AI_CRAWLERS: string[] = [];

export default function robots(): MetadataRoute.Robots {
  // Admin routes are already session-gated, but keeping them out of the index
  // avoids leaking their existence through search results.
  const disallow = ["/admin", "/admin/", "/api/"];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...AI_CRAWLERS.filter(
        (agent) => !BLOCKED_AI_CRAWLERS.includes(agent),
      ).map((userAgent) => ({ userAgent, allow: "/", disallow })),
      ...BLOCKED_AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
