import { AccessCard, SharePayload } from '../types';

const PRIVATE_CARDS_KEY = 'acesso_gratis_private_cards_v1';

export function loadPrivateCards(): AccessCard[] {
  try {
    const raw = localStorage.getItem(PRIVATE_CARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePrivateCards(cards: AccessCard[]): void {
  try {
    localStorage.setItem(PRIVATE_CARDS_KEY, JSON.stringify(cards));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

/**
 * Encodes a SharePayload object into UTF-8 safe URL-friendly Base64.
 */
export function encodeSharePayload(card: AccessCard): string {
  const payload: SharePayload = {
    n: card.ownerName,
    t: card.accountTitle,
    e: card.emailOrUser,
    p: card.password,
    o: card.notes || undefined,
    d: card.createdAt,
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes a UTF-8 Base64 string from #revelar=... back into SharePayload.
 */
export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const normalized = encoded
      .trim()
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.n !== 'string') {
      return null;
    }
    return {
      n: parsed.n,
      t: typeof parsed.t === 'string' && parsed.t ? parsed.t : 'Facebook',
      e: typeof parsed.e === 'string' ? parsed.e : '',
      p: typeof parsed.p === 'string' ? parsed.p : '',
      o: typeof parsed.o === 'string' ? parsed.o : undefined,
      d: typeof parsed.d === 'string' ? parsed.d : undefined,
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(card: AccessCard): string {
  const encoded = encodeSharePayload(card);
  const baseUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  return `${baseUrl}#revelar=${encoded}`;
}

export function getInitials(name: string): string {
  const cleaned = name.trim().replace(/[_\-.]+/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'AG';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_PALETTES = [
  'bg-[#1877F2] text-white',
  'bg-[#0D65D9] text-white',
  'bg-[#2D88FF] text-white',
  'bg-[#1B74E4] text-white',
  'bg-[#2C3E50] text-white',
  'bg-[#0E7490] text-white',
  'bg-[#1D4ED8] text-white',
  'bg-[#0F766E] text-white',
];

export function getAvatarColorClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[index];
}

export function formatPtBrDateTime(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return 'Agora mesmo';
    const now = new Date();
    const isSameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const timeStr = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (isSameDay) {
      return `Hoje às ${timeStr}`;
    }

    const dateStr = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return `${dateStr} às ${timeStr}`;
  } catch {
    return 'Data indisponível';
  }
}
