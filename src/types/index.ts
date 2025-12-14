export type ChatType = 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'video' | 'audio' | 'link';
export type TypingMode = 'text' | 'audio' | 'photo';

export interface UserProfile {
  id: string; // Firebase uid
  phone: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  statusMessage?: string;
  lastSeen?: Date | null;
  online?: boolean;
  favoriteContactIds?: string[];
  favoriteChatIds?: string[];
  createdAt?: Date | null;
}

export interface Contact {
  id: string; // contact doc id (same as contactUserId)
  contactUserId: string;
  displayName: string;
  phone: string;
  avatarUrl?: string;
  lastSeen?: Date | null;
  isFavorite?: boolean;
  createdAt?: Date | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  title?: string;
  avatarUrl?: string;
  memberIds: string[];
  adminId?: string;

  // last message cache
  lastMessageText?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: Date | null;

  // meta
  createdById?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;

  // typing (new)
  // map of uid -> 'text' | 'audio' | 'photo'
  typingStates?: Record<string, TypingMode | null>;

  // legacy typing list (kept for compatibility with existing writes)
  typingUserIds?: string[];

  // direct chat background (from previous feature)
  backgroundImageUrl?: string;

  // invites (new)
  inviteCode?: string | null;
  inviteExpiresAt?: Date | null; // optional expiry
  joinApprovalRequired?: boolean; // when true, requests go to /joinRequests
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;

  text?: string;

  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'audio';
  fileName?: string;
  fileSize?: number;

  // replies / edits (existing enhancements)
  replyToMessageId?: string | null;
  editedAt?: Date | null;

  // reactions (minimal ♥ support; optional)
  list_of_lovers?: string[];

  createdAt?: Date | null;
}

export interface Call {
  id: string;
  participants: string[]; // [from, to]
  fromUserId: string;
  toUserId: string;
  type: 'audio' | 'video';
  status: 'ongoing' | 'ended' | 'missed';
  startedAt?: Date | null;
  endedAt?: Date | null;
}

// Reminders (new)
export interface ReminderItem {
  id: string;
  chatId: string;
  messageId: string;
  at: Date;
  scheduledNotificationId?: string; // expo-notifications id for cancel
}
