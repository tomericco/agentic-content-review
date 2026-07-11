create table revisions (
  id              uuid primary key default gen_random_uuid(),
  review_id       uuid not null references reviews(id) on delete cascade,
  revision_number integer not null,          -- 1, 2, 3...
  content         text not null,
  created_at      timestamptz not null default now(),
  unique (review_id, revision_number)
);

create index revisions_review_id_idx on revisions(review_id);

-- Backfill: every existing review becomes its own revision 1.
insert into revisions (review_id, revision_number, content, created_at)
select id, 1, content, created_at from reviews;

-- Tie comments to revisions; existing comments belong to the backfilled revision 1.
alter table comments add column revision_id uuid references revisions(id) on delete cascade;

update comments c
set revision_id = r.id
from revisions r
where r.review_id = c.review_id;

alter table comments alter column revision_id set not null;
