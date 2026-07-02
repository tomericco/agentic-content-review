import type { Comment } from '@/types'

export interface CommentThread {
  root: Comment
  replies: Comment[]
}

// Groups a flat comment list into threads. Reply-to-reply is supported at
// the data level (parent_id can point to another reply), but display is
// flat: every descendant of a root — no matter which specific comment it
// replied to — lands in that root's single flat `replies` list, sorted by
// created_at. There is no nested replies-of-replies structure.
export function buildCommentThreads(comments: Comment[]): CommentThread[] {
  const byId = new Map(comments.map((c) => [c.id, c]))

  function findRoot(comment: Comment): Comment {
    let current = comment
    const seen = new Set<string>()
    while (current.parent_id !== null) {
      if (seen.has(current.id)) break // defensive: guard against a parent_id cycle
      seen.add(current.id)
      const parent = byId.get(current.parent_id)
      if (!parent) break // orphaned parent_id: treat current as its own root
      current = parent
    }
    return current
  }

  const threadsByRootId = new Map<string, CommentThread>()

  for (const comment of comments) {
    const root = findRoot(comment)
    if (!threadsByRootId.has(root.id)) {
      threadsByRootId.set(root.id, { root, replies: [] })
    }
    if (comment.id !== root.id) {
      threadsByRootId.get(root.id)!.replies.push(comment)
    }
  }

  for (const thread of threadsByRootId.values()) {
    thread.replies.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  return [...threadsByRootId.values()].sort((a, b) => a.root.created_at.localeCompare(b.root.created_at))
}

// Deleting a comment cascades to its replies in the DB (ON DELETE CASCADE on
// parent_id). Client-side optimistic state needs the same behavior — this
// returns the id plus every transitive descendant id, so the caller can
// remove the whole subtree from local state and stay in sync with the DB.
export function collectDescendantIds(comments: Comment[], id: string): string[] {
  const childrenByParentId = new Map<string, string[]>()
  for (const c of comments) {
    if (c.parent_id === null) continue
    const siblings = childrenByParentId.get(c.parent_id) ?? []
    siblings.push(c.id)
    childrenByParentId.set(c.parent_id, siblings)
  }

  const result: string[] = [id]
  const queue = [id]
  while (queue.length > 0) {
    const current = queue.shift()!
    for (const childId of childrenByParentId.get(current) ?? []) {
      result.push(childId)
      queue.push(childId)
    }
  }
  return result
}
