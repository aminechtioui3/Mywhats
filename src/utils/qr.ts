// src/utils/qr.ts
export type QrIntent =
  | { kind: 'join_group'; code: string }         // join group by invite code
  | { kind: 'add_contact'; userId: string };     // add contact by user id

// ---- Builders (what we put inside QR codes) ----

// For profile "Add contact" QR (simple, works both in-app and via scanner screen)
export function buildContactPayload(userId: string): string {
  // short, robust text (no network required)
  return `contact:${userId}`;
}

// If you want a plain text for group join too (you already support URLs / Dynamic Links)
export function buildJoinCodePayload(code: string): string {
  // We still prefer real links (Dynamic Links) for native camera auto-open,
  // but the scanner screen will accept this too.
  return `join:${code}`;
}

// ---- Parser (accept MANY formats) ----
export function parseQrPayload(raw: string): QrIntent | null {
  if (!raw || typeof raw !== 'string') return null;
  const text = raw.trim();

  // 1) Plain schemes
  if (text.startsWith('contact:')) {
    const userId = text.slice('contact:'.length).trim();
    if (userId) return { kind: 'add_contact', userId };
  }
  if (text.startsWith('join:')) {
    const code = text.slice('join:'.length).trim();
    if (code) return { kind: 'join_group', code };
  }

  // 2) Try URL-based formats (Dynamic Links or your own)
  try {
    // If it's a Firebase Dynamic Link, the INNER link is ?link=<encodedURL>
    const outer = new URL(text);
    const innerLink = outer.searchParams.get('link');
    if (innerLink) {
      const inner = new URL(innerLink);
      const byInner = parseUrlForIntent(inner);
      if (byInner) return byInner;
    }

    // Or maybe it’s a direct web URL we control (join / add)
    const byOuter = parseUrlForIntent(outer);
    if (byOuter) return byOuter;
  } catch {
    // not a url — ignore
  }

  // 3) Fallback: try to detect “…/i/<CODE>” pattern
  const iMatch = text.match(/(?:^|\/)i\/([A-Za-z0-9_\-]+)(?:$|[\/?#])/);
  if (iMatch?.[1]) return { kind: 'join_group', code: iMatch[1] };

  return null;
}

function parseUrlForIntent(u: URL): QrIntent | null {
  const pathname = u.pathname || '';
  // “…/i/<code>”
  const iMatch = pathname.match(/(?:^|\/)i\/([A-Za-z0-9_\-]+)(?:$|\/)/);
  if (iMatch?.[1]) return { kind: 'join_group', code: iMatch[1] };

  // “…/join?c=<code>” or “…?code=<code>”
  const code = u.searchParams.get('c') || u.searchParams.get('code');
  if (code) return { kind: 'join_group', code };

  // “…/contact?u=<uid>” or “…?user=<uid>|uid=<uid>”
  const userId = u.searchParams.get('u') || u.searchParams.get('user') || u.searchParams.get('uid');
  if (userId) return { kind: 'add_contact', userId };

  return null;
}
