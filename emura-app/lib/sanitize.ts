import DOMPurify from 'dompurify';

// Single source of truth for notes sanitization. Notes are the only place in
// the app where a stored string is turned into live HTML (QuoteInfoTab renders
// it into a contenteditable div), so every read AND write path must funnel
// through here.
const NOTES_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'em', 'strong', 'img'],
  ALLOWED_ATTR: ['src'],
  ALLOW_DATA_ATTR: false,
};

// Restrict <img src> to data: URIs. The only intended image source is the paste
// handler, which inserts data: URLs exclusively; this strips external URLs that
// authored or imported content could use as tracking pixels (leaking the
// viewer's IP/timestamp when another org member opens a shared quote). Keeps the
// sanitizer in agreement with the CSP img-src 'self' data: directive.
function imgDataUriOnly(node: Element) {
  if (node.nodeName === 'IMG') {
    const src = node.getAttribute('src');
    if (!src || !src.startsWith('data:')) node.removeAttribute('src');
  }
}

// Sanitize notes HTML. The img hook is added/removed around the call so it does
// not leak onto unrelated DOMPurify.sanitize() usages elsewhere.
export function sanitizeNotes(html: string): string {
  DOMPurify.addHook('afterSanitizeAttributes', imgDataUriOnly);
  try {
    return DOMPurify.sanitize(html, NOTES_CONFIG);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
}
