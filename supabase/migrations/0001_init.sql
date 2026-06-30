create extension if not exists "pgcrypto";

create table reviews (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  content          text not null,
  content_type     text not null default 'long_form',
  context          text,
  access           text not null,
  agent_model      text,
  author_email     text not null,
  reviewer_email   text,
  status           text not null default 'pending',
  final_content    text,
  changes_requested text,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

create table comments (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references reviews(id) on delete cascade,
  body         text not null,
  anchor_start integer not null,
  anchor_end   integer not null,
  anchor_text  text not null,
  created_at   timestamptz not null default now()
);

create index comments_review_id_idx on comments(review_id);
