# Agentic Content Review — MVP Design

## Problem

AI agents can generate content, but every publishing platform has a different (often broken) collaboration UX. There is no universal layer where a human can read what the agent produced, leave feedback, optionally edit it, and approve it before it goes live. Teams either skip the review entirely and publish blind, or hack together a flow across Slack, Google Docs, and email.

## MVP Scope

A web app where AI agents upload content for human review and receive a webhook callback when the human decides. The reviewer gets a single magic link — no login, no install.

**Cut from MVP:** CLI, per-reviewer tokens, reviewer identity/accounts, diff view, multiple reviewers.

---

## Architecture

```
┌─────────────────────┐    MCP / raw API    ┌──────────────────────┐
│   AI Agent          │ ──────────────────► │  Next.js App         │
│ (Claude, Claude Code│                     │  (Vercel)            │
│  or any agent)      │                     │                      │
└─────────────────────┘                     │  POST /api/upload    │
                                            │  GET  /[slug]        │
        Webhook callback ◄───────────────── │  POST /api/decide    │
                                            └──────────┬───────────┘
                                                       │
                                            ┌──────────▼───────────┐
                                            │  Supabase            │
                                            │  - Postgres (data)   │
                                            └──────────────────────┘
```

**Three deployable pieces:**
- **Next.js app** — review UI + all API routes, deployed to Vercel
- **MCP server** — npm package exposing `upload_for_review` tool, primary integration for Claude agents
- **Raw API** — any agent can call `POST /api/upload` directly without the MCP server

---

## Upload API

`POST /api/upload`

**Request:**
```json
{
  "title": "June newsletter intro",
  "content": "The full content body (markdown or plain text)",
  "content_type": "long_form",
  "context": "Requirements: upbeat tone, under 200 words, mention the new pricing page",
  "access": "comment_and_edit",
  "webhook_url": "https://your-agent-callback.com/hook"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Human-readable, shown in review UI |
| `content` | yes | Markdown or plain text |
| `content_type` | yes | Controls review UI layout. Supported in MVP: `"long_form"` (blogs, help articles). Future: `"ad"`, `"ux_copy"`, `"email"`, `"social"` |
| `context` | no | Brief, requirements, project info — shown to reviewer |
| `access` | yes | `"comment"` or `"comment_and_edit"` |
| `webhook_url` | yes | Where to POST the decision |

**Response:**
```json
{
  "review_id": "uuid",
  "slug": "june-newsletter-intro",
  "review_url": "https://yourdomain.com/june-newsletter-intro",
  "status": "pending"
}
```

**Slug generation:** Generated server-side by slugifying the `title` field (lowercase, spaces to hyphens, special characters stripped). Example: `"June Newsletter Intro"` → `june-newsletter-intro`. If a collision occurs, a random word is appended to keep the slug readable (e.g., `june-newsletter-intro-amber`, `june-newsletter-intro-falcon`). The agent never specifies the slug — it receives it in the response.

---

## MCP Server

Exposes two tools for Claude and Claude Code agents:

**Tool: `upload_for_review`**

```
Arguments:
  title          string   — title of the content
  content        string   — the content body
  content_type   enum     — "long_form" (MVP only)
  context        string   — optional context for the reviewer
  access         enum     — "comment" | "comment_and_edit"
  webhook_url    string   — callback URL for the decision

Returns:
  review_url     string   — the link to send to the reviewer
  slug           string   — the readable slug
  review_id      string   — UUID for status polling
```

**Tool: `get_review_summary`**

```
Arguments:
  slug           string   — the review slug returned by upload_for_review

Returns:
  summary        string   — markdown-formatted summary of the decision,
                            edits, and comments; ready to paste into a prompt
  status         enum     — "pending" | "approved" | "rejected"
```

---

## Review Page `/[slug]`

The reviewer opens the link — no login, no friction.

**Layout:**
- **Header:** title, content type badge, access mode badge, Approve and Request Changes buttons
- **Context panel:** collapsible sidebar showing the agent's context (requirements, project info)
- **Content area:** rendered according to `content_type`. In MVP (`long_form`): wide readable column, markdown rendered, generous line height — optimised for reading long articles. If `access = "comment_and_edit"`, the reviewer can click anywhere to edit inline. If `access = "comment"`, content is read-only.
- **Comments panel:** reviewer can highlight any span of text and attach a comment. Comments are timestamped and shown in a side thread. Anonymous (no identity required in MVP).

**Approve flow:** one click → fires webhook immediately with final content and all comments.

**Request Changes flow:** clicking Request Changes opens a modal that summarises the inline comments already left by the reviewer. An optional free-text field allows adding general context or feedback that doesn't fit a specific comment. The webhook fires with all inline comments as the primary signal, plus the optional general feedback. The agent is expected to revise and resubmit a new review.

---

## Webhook Payload

Fired to `webhook_url` on approve or reject:

```json
{
  "review_id": "uuid",
  "slug": "june-newsletter-intro",
  "status": "approved",
  "final_content": "The content body as edited by the reviewer",
  "comments": [
    {
      "body": "This sentence is unclear",
      "anchor_text": "The quick brown fox jumps over the lazy dog",
      "anchor_start": 142,
      "anchor_end": 189,
      "created_at": "2026-06-30T10:00:00Z"
    }
  ],
  "changes_requested": null,
  "decided_at": "2026-06-30T10:01:00Z"
}
```

---

## Agent-Readable Summary Endpoint

`GET /api/review/[slug]/summary`

Returns a markdown-formatted summary of the review decision — designed to be passed directly into an agent's next prompt as context, with no parsing required.

**Example response (approved):**
```markdown
# Review Summary: June newsletter intro

**Status:** Approved
**Decided at:** 2026-06-30T10:01:00Z

## Final Content
The full content body as edited by the reviewer...

## Human Edits
The reviewer made edits to the content. Compare the original and final content above to see what changed.

## Comments (2)

1. On: "The quick brown fox jumps over the lazy dog"
   → "This sentence is unclear — consider simplifying."

2. On: "pricing page"
   → "Make sure this links to the new /pricing URL, not the old one."
```

**Example response (changes requested):**
```markdown
# Review Summary: June newsletter intro

**Status:** Changes Requested
**Decided at:** 2026-06-30T10:01:00Z

## Comments (1)

1. On: "We are pleased to announce"
   → "This is corporate-speak. Cut it."

## General Feedback
Tone is too formal overall. Please rewrite to sound more conversational.
```

The MCP server exposes this as a `get_review_summary` tool alongside `upload_for_review`, so agents can poll for the outcome and read it natively in Claude.

---

## Data Model

**`reviews`**
```
id               uuid PK
slug             text UNIQUE
title            text
content          text
content_type     text          -- "long_form" (MVP); future: "ad", "ux_copy", "email", "social"
context          text
access           text          -- "comment" | "comment_and_edit"
webhook_url      text
status           text          -- "pending" | "approved" | "changes_requested" | "webhook_failed"
final_content    text          -- content after reviewer edits (set on approve)
changes_requested text         -- optional general feedback from the reviewer (inline comments are the primary signal)
created_at       timestamptz
decided_at       timestamptz
```

**`comments`**
```
id               uuid PK
review_id        uuid FK → reviews.id
body             text
anchor_start     int           -- character offset in content
anchor_end       int
anchor_text      text          -- the actual quoted text the comment is attached to
created_at       timestamptz
```

---

## Content Formats

The server accepts and stores content as-is without transformation. The review UI renders it based on `content_type`.

| Format | Support |
|--------|---------|
| Markdown | Primary — rendered in the review UI for `long_form` |
| Plain text | Valid fallback — rendered as-is |
| HTML | Not supported (XSS risk, agents don't need it) |

---

## Error Handling

### Upload API errors (`POST /api/upload`)

| Scenario | Status | Code |
|----------|--------|------|
| Missing required field | `400` | `missing_field: "<field_name>"` |
| Invalid `content_type` | `400` | `unsupported_content_type` |
| Invalid `access` value | `400` | `invalid_access_mode` |
| `webhook_url` is not a valid URL | `400` | `invalid_webhook_url` |
| Content exceeds 200KB | `413` | `content_too_large` |

### Review decision errors (`POST /api/decide`)

| Scenario | Status | Code |
|----------|--------|------|
| Slug not found | `404` | `review_not_found` |
| Review already decided | `409` | `review_already_decided` |
| Request Changes with no comments and no general feedback | `400` | `changes_requested_requires_feedback` |

### Webhook delivery

The server fires the webhook after a decision. If delivery fails, it retries 3 times with exponential backoff (5s → 30s → 2min). After all retries are exhausted, the review is marked `webhook_failed` in the database and the summary endpoint surfaces this status. No error is returned to the reviewer — the decision is still recorded.

---

## What's Deferred

| Feature | Why deferred |
|---------|--------------|
| Reviewer identity / accounts | Adds friction; revisit once usage patterns are clear |
| Per-reviewer tokens | Depends on identity system |
| Diff view | Requires storing original + edited versions and a diff UI |
| CLI | MCP + raw API covers all agent types for MVP |
| Multiple reviewers | Depends on identity system |
| Content expiry | Not needed until scale |

---

## Decided

1. **Native platform integrations post-MVP:** None planned — raw API and MCP cover all agent types for now.
2. **Reviewer identity:** OAuth (post-MVP).
3. **Comment notifications to agent:** No. The webhook fires only once, after the final decision (approved or changes requested). Comments are included in that single payload.
