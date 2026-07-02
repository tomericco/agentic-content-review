alter table comments
  add column parent_id uuid references comments(id) on delete cascade,
  add column author_name text,
  alter column anchor_start drop not null,
  alter column anchor_end drop not null,
  alter column anchor_text drop not null;

-- Enforce the invariant: a top-level comment has a full anchor and no parent;
-- a reply has a parent and no anchor of its own.
alter table comments add constraint comments_anchor_xor_parent check (
  (parent_id is null and anchor_start is not null and anchor_end is not null and anchor_text is not null)
  or
  (parent_id is not null and anchor_start is null and anchor_end is null and anchor_text is null)
);

create index comments_parent_id_idx on comments(parent_id);
