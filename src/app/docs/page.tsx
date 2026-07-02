"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const BASE = "https://amend.to";

const UPLOAD_EXAMPLE = `POST ${BASE}/api/upload
Content-Type: application/json

{
  "title": "Q2 product update",
  "content": "We shipped three features this quarter...",
  "content_type": "long_form",
  "access": "comment_and_edit",
  "author_email": "agent@example.com",
  "reviewer_email": "human@example.com",
  "webhook_url": "https://your-app.com/webhook/amend"
}`;

const UPLOAD_RESPONSE = `{
  "slug": "abc123",
  "amend_url": "${BASE}/abc123",
  "summary_url": "${BASE}/api/amend/abc123/summary",
  "resubmit_url": "${BASE}/api/amend/abc123/resubmit"
}`;

const SUMMARY_EXAMPLE = `GET ${BASE}/api/amend/[slug]/summary`;

const SUMMARY_RESPONSE = `# Amend Summary: Q2 product update

**Status:** approved
**Decided at:** 2026-07-01T10:23:00Z

## Final Content

We shipped three features this quarter...

## Comments

1. "Consider softening the tone in paragraph 2" (chars 45–89)

## Decision

Approved with minor edits applied inline.`;

const SUMMARY_RESPONSE_CHANGES_REQUESTED = `# Amend Summary: Q2 product update

**Status:** changes_requested

## Comments (1)

1. On: "we dominated"
   → "Consider softening the tone" — Quick Falcon

## General Feedback

Tone is too aggressive for this audience — please soften it.

## Next Step

Revise the content based on the feedback above, then PATCH your new version to:
${BASE}/api/amend/abc123/resubmit`;

const RESUBMIT_EXAMPLE = `PATCH ${BASE}/api/amend/abc123/resubmit
Content-Type: application/json

{
  "content": "We shipped three features this quarter, with a lighter tone..."
}`;

const RESUBMIT_RESPONSE = `{
  "slug": "abc123",
  "amend_url": "${BASE}/abc123",
  "summary_url": "${BASE}/api/amend/abc123/summary",
  "resubmit_url": "${BASE}/api/amend/abc123/resubmit",
  "status": "pending"
}`;

const WEBHOOK_PAYLOAD = `POST https://your-app.com/webhook/amend
Content-Type: application/json

{
  "slug": "abc123",
  "status": "approved",
  "final_content": "We shipped three features this quarter...",
  "changes_requested": null,
  "comments": [
    {
      "body": "Consider softening the tone in paragraph 2",
      "anchor_text": "we dominated",
      "anchor_start": 45,
      "anchor_end": 57
    }
  ]
}`;


function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mb-6">
      <pre className="bg-zinc-950 text-zinc-100 text-[13px] leading-relaxed rounded-lg p-4 overflow-x-auto">
        <code>{code}</code>
      </pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="absolute top-3 right-3 text-[11px] text-zinc-400 hover:text-white bg-zinc-800 px-2 py-1 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

const quickStartJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Get a human decision on AI-generated content",
  step: [
    {
      "@type": "HowToStep",
      position: 1,
      name: "Submit content",
      text: "POST your content to /api/upload. You get back an amend_url.",
    },
    {
      "@type": "HowToStep",
      position: 2,
      name: "Share with reviewer",
      text: "Share the amend_url with the reviewer. They click it, read the content, leave comments, edit inline, and decide.",
    },
    {
      "@type": "HowToStep",
      position: 3,
      name: "Receive the decision",
      text: "Get the decision back via webhook — or poll GET /api/amend/[slug]/summary and paste it into your next prompt.",
    },
  ],
};

const NAV_SECTIONS = [
  {
    title: "Getting Started",
    links: [
      { label: "Overview", href: "#overview" },
      { label: "Quick start", href: "#quick-start" },
    ],
  },
  {
    title: "API Reference",
    links: [
      { label: "POST /upload", href: "#upload" },
      { label: "GET /summary", href: "#summary" },
      { label: "PATCH /resubmit", href: "#resubmit" },
      { label: "Webhook payload", href: "#webhook" },
      { label: "Access control", href: "#access" },
    ],
  },
];

const SECTION_IDS = NAV_SECTIONS.flatMap((section) =>
  section.links.map((link) => link.href.slice(1))
);

export default function DocsPage() {
  const [activeId, setActiveId] = useState(SECTION_IDS[0]);

  useEffect(() => {
    const NAV_OFFSET = 110; // fixed nav height + a little breathing room

    function updateActiveSection() {
      let current = SECTION_IDS[0];
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - NAV_OFFSET <= 0) {
          current = id;
        }
      }
      setActiveId(current);
    }

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    const id = href.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    history.replaceState(null, "", href);
  }

  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-geist-sans)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(quickStartJsonLd) }}
      />
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-100">
        <Link href="/" className="text-base font-semibold tracking-tight">
          amend
        </Link>
        <Link href="/docs" className="text-sm font-medium text-zinc-500 hover:text-black">
          Docs
        </Link>
      </nav>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        <div className="sm:flex sm:gap-14">
          {/* Sidebar */}
          <aside className="hidden sm:block sm:w-44 sm:shrink-0">
            <div className="sticky top-24 flex flex-col gap-6">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold mb-2">
                    {section.title}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {section.links.map((link) => {
                      const isActive = activeId === link.href.slice(1);
                      return (
                        <li key={link.href}>
                          <a
                            href={link.href}
                            onClick={(e) => handleNavClick(e, link.href)}
                            className={
                              isActive
                                ? "text-sm font-semibold text-black"
                                : "text-sm text-zinc-600 hover:text-black"
                            }
                          >
                            {link.label}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-2.5">
            <h1 className="sr-only">amend Documentation</h1>

            <section id="overview" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-0 mb-4 scroll-mt-24">
                Overview
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                amend is a human-in-the-loop layer for AI agents. Your agent
                submits content via a simple HTTP API, a human reviews it through
                a magic link (no login required), and the decision — along with
                any edits or comments — webhooks back to your agent.
              </p>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                It works with any agent that can make HTTP requests: Claude Code,
                Cursor, Codex, Amp, Gemini, or a custom script.
              </p>
            </section>

            <section id="quick-start" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                Quick start
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                Three steps to get a human decision on AI-generated content:
              </p>
              <ol className="list-decimal pl-6 text-[15px] text-zinc-700 space-y-2 mb-6">
                <li>
                  POST your content to <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">/api/upload</code>. You get back an <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">amend_url</code>.
                </li>
                <li>
                  Share the <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">amend_url</code> with the reviewer.
                  They click it, read the content, leave comments, edit inline, and
                  decide.
                </li>
                <li>
                  Get the decision back via webhook — or poll the <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">summary_url</code> from step 1 and paste it into your next prompt.
                </li>
              </ol>
            </section>

            <section id="upload" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                POST /api/upload
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                Submit content for review. Returns an <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">amend_url</code> to
                send to the reviewer, a <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">summary_url</code> your agent can poll
                directly, and a <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">resubmit_url</code> to send a revised draft
                if changes are requested — none of these need to be constructed by hand.
              </p>
              <CodeBlock code={UPLOAD_EXAMPLE} />
              <p className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Fields
              </p>
              <table className="w-full text-[13px] text-zinc-700 mb-6 border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 pr-4 font-semibold text-zinc-950">Field</th>
                    <th className="text-left py-2 pr-4 font-semibold text-zinc-950">Type</th>
                    <th className="text-left py-2 font-semibold text-zinc-950">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[
                    ["title", "string", "Title shown to the reviewer"],
                    ["content", "string", "Markdown or plain text content"],
                    ["content_type", '"long_form"', "Content type (only long_form supported)"],
                    ["access", '"comment_and_edit" | "comment"', "Whether the reviewer can edit inline"],
                    ["author_email", "string", "Email of the agent/author"],
                    ["reviewer_email", "string", "Email shown on the review page"],
                    ["webhook_url", "string (optional)", "URL to POST the decision to when reviewer decides"],
                  ].map(([field, type, desc]) => (
                    <tr key={field}>
                      <td className="py-2 pr-4 font-mono text-[12px]">{field}</td>
                      <td className="py-2 pr-4 text-zinc-500 font-mono text-[12px]">{type}</td>
                      <td className="py-2 text-zinc-600">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Response
              </p>
              <CodeBlock code={UPLOAD_RESPONSE} />
            </section>

            <section id="summary" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                GET /api/amend/[slug]/summary
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                Returns a markdown summary of the amend — status, final content,
                and all comments. Useful for polling or pasting directly into your
                next agent prompt.
              </p>
              <CodeBlock code={SUMMARY_EXAMPLE} />
              <p className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Example response — approved
              </p>
              <CodeBlock code={SUMMARY_RESPONSE} />
              <p className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Example response — changes requested
              </p>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                When changes are requested, the summary includes a <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">## Next Step</code> section
                with the exact <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">resubmit_url</code> to PATCH your revised content to —
                paste this whole response into your next prompt and the agent has everything it needs.
              </p>
              <CodeBlock code={SUMMARY_RESPONSE_CHANGES_REQUESTED} />
            </section>

            <section id="resubmit" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                PATCH /api/amend/[slug]/resubmit
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                Send a revised draft after changes were requested. Resets the review back to <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">pending</code> so
                the reviewer sees the new version. Only valid when the review isn&apos;t currently <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">pending</code>.
              </p>
              <CodeBlock code={RESUBMIT_EXAMPLE} />
              <p className="text-[13px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                Response
              </p>
              <CodeBlock code={RESUBMIT_RESPONSE} />
            </section>

            <section id="webhook" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                Webhook payload
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                When the reviewer clicks Approve or Request Changes, a POST is sent
                to the <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">webhook_url</code> you provided at upload time.
              </p>
              <CodeBlock code={WEBHOOK_PAYLOAD} />
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">status</code> is either{" "}
                <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">"approved"</code> or{" "}
                <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">"changes_requested"</code>.
                When changes are requested, <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">changes_requested</code> contains
                the reviewer's note and <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">final_content</code> reflects any inline
                edits they made.
              </p>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">webhook_url</code> is optional.
                If you omit it, poll{" "}
                <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">GET /api/amend/[slug]/summary</code> for the decision.
              </p>
            </section>

            <section id="access" className="scroll-mt-24">
              <h2 className="text-xl font-semibold text-zinc-950 mt-12 mb-4 scroll-mt-24">
                Access control
              </h2>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                The <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">access</code> field controls what the reviewer can do:
              </p>
              <ul className="list-disc pl-6 text-[15px] text-zinc-700 space-y-2 mb-4">
                <li>
                  <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">comment_and_edit</code> — the reviewer can leave inline
                  comments and edit the content directly. Final edits are reflected
                  in the webhook payload and summary.
                </li>
                <li>
                  <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-[13px]">comment</code> — the reviewer can only leave comments.
                  The content is read-only.
                </li>
              </ul>
              <p className="text-[15px] leading-relaxed text-zinc-700 mb-4">
                Anyone with the amend URL can access it — the link is the only
                access control. Share it only with the intended reviewer.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
