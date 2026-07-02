"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/Logo";

const AGENT_INSTRUCTIONS = `# Install amend

You are the content creator here — amend (https://www.amend.to) lets you
send content you've written to a human for review before it ships, then
hands their feedback back to you so you can act on it. Keep replies
succinct — don't narrate each step to the user.

## 1. Submit your content for human review

POST the content you wrote to \`/api/upload\`:

\`\`\`
POST https://www.amend.to/api/upload
Content-Type: application/json

{
  "title": "string — shown to the human reviewer",
  "content": "string — the content you wrote, markdown or plain text",
  "content_type": "long_form",
  "access": "comment_and_edit" | "comment"
}
\`\`\`

The response includes three URLs — always use these exactly as returned,
never construct them yourself:
- \`amend_url\` — share this with the human reviewer
- \`summary_url\` — poll this for their decision (step 2)
- \`resubmit_url\` — use this if they request changes (step 3)

## 2. Get the human reviewer's feedback

GET the \`summary_url\` from the response above:

\`\`\`
GET <summary_url>
\`\`\`

Returns a markdown summary of what the human reviewer decided — status, any
comments they left, and (if they approved it) the final content, including
any edits they made. Paste it directly into your next prompt.

## 3. Revise and resubmit based on their feedback

If the summary's status is \`changes_requested\`, rewrite your content to
address the human reviewer's feedback, then PATCH your revised draft to the
\`resubmit_url\` from the summary:

\`\`\`
PATCH <resubmit_url>
Content-Type: application/json

{
  "content": "string — your revised draft, addressing their feedback"
}
\`\`\`

This sends your new draft back to the same human reviewer and clears the
old comments (they anchored to your previous draft, not this one) — repeat
step 2 to poll for their next decision.

## Important tips

- You are the author; the human at \`amend_url\` is the reviewer — only they can approve or request changes, you cannot decide for them.
- Never construct \`amend_url\`, \`summary_url\`, or \`resubmit_url\` yourself — always use the ones returned by the API.
- No account or API key needed — the review link itself is the access control, so only share it with the intended reviewer.
- A review can only be resubmitted when its status isn't already \`pending\`.`;

const FAQ = [
  {
    q: "What is this?",
    a: "A review layer between AI agents and publishing. Your agent uploads content, a human reviews it via a magic link, and the decision webhooks back.",
  },
  {
    q: "Who's the reviewer?",
    a: "Anyone you send the link to. No account, no install, no friction — they click and review.",
  },
  {
    q: "Can reviewers edit the content?",
    a: 'Yes. Set access to "comment_and_edit" and reviewers can edit inline. Set it to "comment" for read-only with comments.',
  },
  {
    q: "What agents and tools does this work with?",
    a: "Any agent that can make HTTP requests — Claude Code, Cursor, Codex, Amp, or anything else.",
  },
  {
    q: "How does my agent get the decision?",
    a: "Via webhook, fired immediately when the reviewer decides. Or poll GET /api/amend/[slug]/summary for a markdown summary ready to paste into your next prompt.",
  },
  {
    q: "Who can access the review link?",
    a: "Anyone with the link. There's no authentication — the magic link is the access control.",
  },
  {
    q: "Is it free?",
    a: "Yes.",
  },
  {
    q: "Why not just use Slack or email for approvals?",
    a: "With Slack or email, someone has to read the thread and copy the decision back to your agent by hand. amend gives your agent a clean answer — approved, edited, or declined — that it can use right away.",
  },
  {
    q: "What kind of content can I submit for review?",
    a: "Long-form writing, like a blog post or article. Plain text or markdown both work.",
  },
  {
    q: "Do I need to install anything or sign up?",
    a: "No. There's nothing to install and no account to create. Your agent sends the content, and the reviewer just clicks a link.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

const AGENTS = [
  { name: "Claude Code", slug: "claudecode" },
  { name: "Cursor", slug: "cursor" },
  { name: "GitHub Copilot", slug: "githubcopilot" },
  { name: "Windsurf", slug: "windsurf" },
  { name: "Gemini", slug: "googlegemini" },
];

export default function Home() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(AGENT_INSTRUCTIONS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="min-h-screen bg-white text-black font-[family-name:var(--font-geist-sans)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-white">
        <Logo />
        <Link href="/docs" className="text-sm font-medium text-zinc-500 hover:text-black">
          Docs
        </Link>
      </nav>

      {/* Hero */}
      <main className="pt-40 pb-32 px-8 lg:pl-[35%] lg:pr-24">
        <h1 className="text-5xl font-bold tracking-tight mb-10 max-w-md">
          Free content review tool for agents
        </h1>

        {/* Steps */}
        <div className="flex flex-col gap-4 mb-12 max-w-md">
          {[
            "Just tell your agent to post content to amend.to",
            "You get a magic link — no login, no install",
            "You and team review and submit feedback — sent directly to your agent",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 bg-black text-white text-[12px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-base text-gray-700 leading-snug">{step}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-20">
          <div className="flex flex-col gap-2.5">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Try it now
            </p>
            <button
              onClick={copy}
              className="flex items-center gap-2.5 bg-black text-white text-sm px-5 py-3 whitespace-nowrap rounded-md cursor-pointer"
            >
              {copied ? (
                "Copied! Paste into your agent"
              ) : (
                <>
                  Copy instructions for my agent
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="1" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">
              Works with every agent
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              {AGENTS.map(({ name, slug }) => (
                <span key={slug} title={name} className="flex items-center justify-center">
                  <Image
                    src={`https://cdn.simpleicons.org/${slug}/6b7280`}
                    alt={name}
                    width={26}
                    height={26}
                    unoptimized
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Divider */}
      <hr className="mx-8 border-gray-200" />

      {/* FAQ */}
      <section className="py-24 px-8 lg:pl-[35%] lg:pr-24">
        <h2 className="text-4xl font-bold tracking-tight mb-12">FAQ</h2>
        <div className="flex flex-col gap-9 max-w-lg">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <p className="text-base font-semibold mb-1.5">{q}</p>
              <p className="text-base text-gray-600 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 lg:pl-[35%] lg:pr-24 py-10 border-t border-gray-100">
        <p className="text-sm text-gray-400">
          © 2026 amend — human review for AI agents
        </p>
      </footer>
    </div>
  );
}
