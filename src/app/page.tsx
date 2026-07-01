"use client";

import { useState } from "react";
import Link from "next/link";

const AGENT_INSTRUCTIONS = `To submit content for human review, POST to:
https://agentic-content-review.vercel.app/api/upload

Required fields:
- title: string
- content: string (markdown or plain text)
- content_type: "long_form"
- access: "comment_and_edit" or "comment"
- author_email: string
- reviewer_email: string
- webhook_url: string (where to send the decision)

The response includes an amend_url. Share it with the reviewer. When they decide, the webhook fires with the final content, all comments, and the decision status.`;

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

const AGENTS = ["Claude", "Cursor", "Codex", "Amp", "Gemini"];

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
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-white">
        <span className="text-base font-semibold tracking-tight">amend</span>
        <Link href="/docs" className="text-sm font-medium text-zinc-500 hover:text-black">
          Docs
        </Link>
      </nav>

      {/* Hero */}
      <main className="pt-40 pb-32 px-8 lg:pl-[35%] lg:pr-24">
        <h1 className="text-5xl leading-[1.05] font-bold tracking-tight mb-10 max-w-md">
          Human review,
          <br />
          for AI content.
        </h1>

        {/* Steps */}
        <div className="flex flex-col gap-4 mb-12 max-w-md">
          {[
            "Your agent POSTs content to the API — title, body, webhook URL",
            "The reviewer gets a magic link — no login, no install",
            "They approve, edit, or request changes — the decision webhooks back",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 shrink-0 w-5 h-5 bg-black text-white text-[10px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-base text-gray-700 leading-snug">{step}</p>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-20">
          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              For agents
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
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              Works with every agent
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {AGENTS.map((name) => (
                <span
                  key={name}
                  className="text-xs font-medium text-gray-500 border border-gray-200 px-2.5 py-1.5 leading-none"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Divider */}
      <hr className="mx-8 lg:ml-[35%] lg:mr-24 border-gray-200" />

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
