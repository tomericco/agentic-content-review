# SDD Progress Ledger — Agentic Content Review

## Status

| Task | Description | Status |
|------|-------------|--------|
| 1 | Project Scaffold + Supabase Schema | ✅ complete (d00beca..e0d7e4b, review clean) |
| 2 | Slug Generation | ✅ complete (e0d7e4b..1c29c09, review clean) |
| 3 | Request Validation | ✅ complete (1c29c09..0cf84cf, review clean) |
| 4 | Database Layer | ✅ complete (0cf84cf..6834940, review clean) |
| 5 | (removed from MVP) | skipped |
| 6 | Summary Generation | ✅ complete (6834940..bf75d43, review clean) |
| 7 | POST /api/upload | ✅ complete (bf75d43..2742f2e, review clean) |
| 8 | Decide, Resubmit, Summary routes | ✅ complete (2742f2e..0fc229b, review clean) |
| 9 | POST /api/review/[slug]/comment | ✅ complete (0fc229b..a128cdc, review clean) |
| 10 | Review Page — Server Shell + Header | ✅ complete (a128cdc..20f4cf5, fix: handleApprove guard) |
| 11 | Content Editor (Tiptap WYSIWYG) | ✅ complete (20f4cf5..1b18f09, review clean). Minor: window.innerWidth in SSR context, onClose callback ref churn, silent comment submission failure, unhandled fetch throw in popover. |
| 12 | Marginal Comments + Request Changes Modal | ✅ complete (1b18f09..09c1775, review clean). Minor: smart quotes replaced with &quot; in card display; whitespace-only generalFeedback shows empty reviewer note; setSubmitting not reset on modal close. |
| 13 | Email Notifications + Share With Agent | ✅ complete (09c1775..bfeea53, fix: HTML escaping in email templates) |
| 14 | Deploy to Vercel | ✅ code pushed to https://github.com/tomergab/agentic-content-review. Vercel auth expired — human must run `npx vercel login` then `npx vercel --prod` and set env vars. |

## Completed Tasks

Task 1: complete (commits d00beca..e0d7e4b, review clean). Minor: Tailwind v4 installed (no tailwind.config.ts — CSS-based config in globals.css). Task 11 implementer must use @theme in globals.css instead of tailwind.config.ts for font families.
Task 2: complete (e0d7e4b..1c29c09, review clean)
Task 3: complete (1c29c09..0cf84cf, review clean)
Task 4: complete (0cf84cf..6834940, review clean)
Task 5: skipped (removed from MVP)
Task 6: complete (6834940..bf75d43, review clean)
Task 7: complete (bf75d43..2742f2e, review clean)
Task 8: complete (2742f2e..0fc229b, review clean)
Task 9: complete (0fc229b..a128cdc, review clean)
Task 10: complete (a128cdc..20f4cf5, fix: handleApprove guard)
Task 11: complete (20f4cf5..1b18f09, review clean). Minor: window.innerWidth, onClose ref churn, silent comment failure, unhandled fetch throw.
Task 12: complete (1b18f09..09c1775, review clean). Minor: smart quotes, whitespace generalFeedback, setSubmitting not reset.
Task 13: complete (09c1775..bfeea53, fix: HTML escaping in email templates)
Task 14: code pushed to https://github.com/tomergab/agentic-content-review. Vercel manual steps required.
Final review fixes: complete (bfeea53..e2e7a17). Branch ready to merge.
