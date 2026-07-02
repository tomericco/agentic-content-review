import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
import type { Comment } from '@/types'

export const commentHighlightKey = new PluginKey<DecorationSet>('commentHighlight')

function findCommentDecorations(doc: Node, comments: Comment[]): Decoration[] {
  const decos: Decoration[] = []
  comments.forEach((comment) => {
    const { anchor_start: from, anchor_end: to, anchor_text: text } = comment
    // Replies have no anchor of their own (they inherit their thread root's
    // position) — nothing to highlight for them. Callers should already filter
    // to root comments, but this guard is cheap defense-in-depth.
    if (from === null || to === null || text === null) return

    // Primary: use the stored ProseMirror positions directly.
    // Verify the text still matches (fails if document was heavily edited).
    if (from > 0 && to > from && to <= doc.content.size) {
      try {
        // Images have no text content to compare — if the position still
        // points at an image node, trust it directly.
        const node = doc.nodeAt(from)
        if (node && node.type.name === 'image') {
          decos.push(makeCommentDeco(doc, from, to, comment.id))
          return
        }
        if (doc.textBetween(from, to, ' ') === text) {
          decos.push(makeCommentDeco(doc, from, to, comment.id))
          return
        }
      } catch { /* positions out of range */ }
    }

    // Fallback: find the occurrence of anchor_text closest to anchor_start.
    // This handles edited documents and avoids picking the wrong duplicate.
    let bestFrom = -1
    let bestDist = Infinity
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      let idx = node.text.indexOf(text)
      while (idx !== -1) {
        const dist = Math.abs(pos + idx - from)
        if (dist < bestDist) { bestDist = dist; bestFrom = pos + idx }
        idx = node.text.indexOf(text, idx + 1)
      }
    })

    // Note: images have no text content, so they can't be re-found by this
    // text search if their position drifts (e.g. content was heavily
    // edited) — same degradation as a text anchor whose surrounding text
    // changed enough that even the fallback can't relocate it.
    if (bestFrom !== -1) {
      decos.push(makeCommentDeco(doc, bestFrom, bestFrom + text.length, comment.id))
    }
  })
  return decos
}

export function makeCommentDeco(doc: Node, from: number, to: number, commentId: number | string): Decoration {
  const node = doc.nodeAt(from)
  if (node && node.type.name === 'image') {
    // Node decorations apply attrs directly to the image's own DOM element —
    // an inline decoration can't meaningfully "wrap" an atomic leaf node.
    return Decoration.node(
      from, to,
      { class: 'comment-highlight-image', 'data-comment-id': String(commentId) },
      { commentId: String(commentId) },
    )
  }
  return Decoration.inline(
    from, to,
    { class: 'comment-highlight', 'data-comment-id': String(commentId) },
    // spec (third arg) is what decos[0].spec returns — attrs are HTML-only
    { commentId: String(commentId) },
  )
}

export function buildCommentHighlightExtension(initialComments: Comment[]) {
  return Extension.create({
    name: 'commentHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: commentHighlightKey,
          state: {
            init(_, state) {
              const decos = findCommentDecorations(state.doc, initialComments)
              return DecorationSet.create(state.doc, decos)
            },
            apply(tr, oldSet) {
              // Remap existing decorations through the transaction so they
              // follow their text as the document changes.
              let set = oldSet.map(tr.mapping, tr.doc)
              // New decorations arrive via transaction meta (when a comment is saved).
              const newDecos: Decoration[] | undefined = tr.getMeta(commentHighlightKey)
              if (newDecos?.length) set = set.add(tr.doc, newDecos)
              return set
            },
          },
          props: {
            decorations(state) {
              return commentHighlightKey.getState(state)
            },
          },
        }),
      ]
    },
  })
}
