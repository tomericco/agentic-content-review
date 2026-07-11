export type ReviewStatus = 'pending' | 'approved' | 'changes_requested'
export type ContentType = 'long_form'
export type AccessMode = 'comment' | 'comment_and_edit'

export interface Review {
  id: string
  slug: string
  title: string
  content: string
  content_type: ContentType
  context: string | null
  access: AccessMode
  agent_model: string | null
  author_email: string | null
  reviewer_email: string | null
  status: ReviewStatus
  final_content: string | null
  changes_requested: string | null
  created_at: string
  decided_at: string | null
}

export interface Revision {
  id: string
  review_id: string
  revision_number: number
  content: string
  created_at: string
}

export interface Comment {
  id: string
  review_id: string
  revision_id: string
  parent_id: string | null
  body: string
  anchor_start: number | null
  anchor_end: number | null
  anchor_text: string | null
  author_name: string | null
  created_at: string
}
