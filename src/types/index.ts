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
  author_email: string
  reviewer_email: string | null
  status: ReviewStatus
  final_content: string | null
  changes_requested: string | null
  created_at: string
  decided_at: string | null
}

export interface Comment {
  id: string
  review_id: string
  body: string
  anchor_start: number
  anchor_end: number
  anchor_text: string
  created_at: string
}
