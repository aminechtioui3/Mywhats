// Keep all your route params in one place for type-safety
export type RootStackParamList = {
  Home: undefined;

  // Chat screen already in your project
  Chat: { chatId?: string | null; contactUserId?: string | null } | undefined;

  GroupSettings: { chatId: string };
  GroupInvite: { chatId: string };

  // NEW: user lands here via deep link (…/join?code=XXXX)
  JoinChat: { code: string };

  // If you already have this, keep it; otherwise remove from navigator
  DirectChatSettings?: { chatId: string };
};
