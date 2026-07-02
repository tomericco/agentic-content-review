-- Email sending is currently disabled (see src/lib/email.ts callers, all
-- commented out), so author_email/reviewer_email no longer need to be
-- present to notify anyone. Drop the NOT NULL constraint on author_email
-- (reviewer_email was already nullable).
alter table reviews alter column author_email drop not null;
