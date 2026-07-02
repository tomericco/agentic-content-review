// Guards against a misconfigured NEXT_PUBLIC_BASE_URL missing its protocol
// (e.g. "www.amend.to" instead of "https://www.amend.to") — new URL() throws
// on that and would otherwise take down the entire build via metadataBase.
export function normalizeBaseUrl(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`
}

export const SITE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.amend.to"
);

export const SITE_NAME = "amend";

export const SITE_DESCRIPTION =
  "A human review layer for AI agents. Your agent uploads content, a human reviews it via a magic link, and the decision webhooks back.";
