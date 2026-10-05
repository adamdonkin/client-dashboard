export const ATTACHMENT_BUCKET = 'action-attachments'

// Images are stored privately and embedded in notes by this app URL, which
// checks access and redirects to a short-lived signed URL.
export function attachmentSrc(path: string) {
  return `/api/attachments/${path}`
}
