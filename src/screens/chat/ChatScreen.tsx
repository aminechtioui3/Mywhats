// src/screens/chat/ChatScreen.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  ImageBackground,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import { Chat, Message, TypingMode, UserProfile } from '../../types';
import { colors, radius, spacing } from '../../theme';
import MessageBubble from '../../components/MessageBubble';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import { useRoute, useNavigation } from '@react-navigation/native';
import ConfirmModal from '../../components/ConfirmModal';
import { Swipeable } from 'react-native-gesture-handler';

interface RouteParams {
  chatId?: string | null;
  contactUserId?: string;
}

// Extend Chat locally (no TS changes needed, we just read optional fields)
type ChatPlus = Chat;

const EDIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const ChatScreen: React.FC = () => {
  const { profile } = useAuth();
  const route = useRoute<any>();
  const navigation: any = useNavigation();
  const { chatId: initialChatId, contactUserId } = route.params as RouteParams;

  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [chat, setChat] = useState<ChatPlus | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // Typing
  const [advertisedTyping, setAdvertisedTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reply / edit
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Reminder sheet
  const [reminderTarget, setReminderTarget] = useState<Message | null>(null);

  // ---- Notifications permission (for reminders) 
  useEffect(() => {
    (async () => {
      const settings = await Notifications.getPermissionsAsync();
      if (!settings.granted) {
        await Notifications.requestPermissionsAsync();
      }
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
    })();
  }, []);

  const clearTypingTimer = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  // New: typing state with mode
  const setTypingState = async (mode: TypingMode | null) => {
    if (!chatId || !profile) return;
    try {
      const path = `typingStates.${profile.id}`;
      const ref = doc(db, 'chats', chatId);
      if (mode) {
        await updateDoc(ref, { [path]: mode });
        setAdvertisedTyping(true);
      } else {
        await updateDoc(ref, { [path]: deleteField() });
        setAdvertisedTyping(false);
      }
    } catch (e) {
      // non-fatal
      console.warn('typing state error:', e);
    }
  };

  // (legacy) for compatibility with old UIs if any still read typingUserIds
  const setTypingLegacy = async (on: boolean) => {
    if (!chatId || !profile) return;
    try {
      const ref = doc(db, 'chats', chatId);
      if (on) {
        await updateDoc(ref, { typingUserIds: arrayUnion(profile.id) });
      } else {
        await updateDoc(ref, { typingUserIds: arrayRemove(profile.id) });
      }
    } catch (e) {
      console.warn('typing update error:', e);
    }
  };

  // Ensure one direct chat per pair (me, X)
  useEffect(() => {
    const init = async () => {
      if (!profile) return;
      if (chatId) return;

      if (contactUserId) {
        const directQ = query(
          collection(db, 'chats'),
          where('type', '==', 'direct'),
          where('memberIds', 'array-contains', profile.id)
        );
        const snap = await getDocs(directQ);
        const existing = snap.docs.find((d) => {
          const m = (d.data() as any).memberIds ?? [];
          return m.includes(contactUserId);
        });

        if (existing) {
          setChatId(existing.id);
          return;
        }

        // Create new direct chat
        const newChatRef = await addDoc(collection(db, 'chats'), {
          type: 'direct',
          memberIds: [profile.id, contactUserId],
          createdAt: serverTimestamp(),
          createdById: profile.id,
          updatedAt: serverTimestamp(),
        });
        setChatId(newChatRef.id);
      }
    };
    init();
  }, [chatId, contactUserId, profile?.id]);

  // Listen to chat + messages
  useEffect(() => {
    if (!chatId || !profile) return;

    const chatRef = doc(db, 'chats', chatId);
    const unsubChat = onSnapshot(chatRef, async (snap) => {
      if (!snap.exists()) return;
      const c = snap.data() as any;
      const mapped: ChatPlus = {
        id: snap.id,
        type: c.type,
        title: c.title,
        avatarUrl: c.avatarUrl,
        memberIds: c.memberIds ?? [],
        adminId: c.adminId,
        lastMessageText: c.lastMessageText,
        lastMessageSenderId: c.lastMessageSenderId,
        lastMessageAt: c.lastMessageAt?.toDate ? c.lastMessageAt.toDate() : null,
        createdById: c.createdById,
        createdAt: c.createdAt?.toDate ? c.createdAt.toDate() : null,
        updatedAt: c.updatedAt?.toDate ? c.updatedAt.toDate() : null,
        typingStates: c.typingStates ?? {},
        typingUserIds: c.typingUserIds ?? [],
        backgroundImageUrl: c.backgroundImageUrl ?? undefined,
        inviteCode: c.inviteCode ?? null,
        inviteExpiresAt: c.inviteExpiresAt?.toDate ? c.inviteExpiresAt.toDate() : c.inviteExpiresAt ?? null,
        joinApprovalRequired: c.joinApprovalRequired ?? false,
      } as any; // allow extra fields
      setChat(mapped);

      if (mapped.type === 'direct') {
        const otherId = mapped.memberIds.find((id) => id !== profile.id);
        if (otherId) {
          const uSnap = await getDoc(doc(db, 'users', otherId));
          if (uSnap.exists()) {
            const u = uSnap.data() as any;
            setOtherUser({
              id: uSnap.id,
              phone: u.phone,
              displayName: u.displayName ?? u.phone,
              email: u.email,
              avatarUrl: u.avatarUrl,
              statusMessage: u.statusMessage,
              online: u.online,
              lastSeen: u.lastSeen?.toDate ? u.lastSeen.toDate() : null,
              favoriteChatIds: [],
              favoriteContactIds: [],
              createdAt: null,
            });
          }
        } else {
          // self-chat header
          setOtherUser({
            id: profile.id,
            phone: profile.phone,
            displayName: profile.displayName,
            email: profile.email,
            avatarUrl: profile.avatarUrl,
            statusMessage: profile.statusMessage,
            online: profile.online ?? false,
            lastSeen: profile.lastSeen ?? null,
            favoriteChatIds: profile.favoriteChatIds ?? [],
            favoriteContactIds: profile.favoriteContactIds ?? [],
            createdAt: profile.createdAt ?? null,
          });
        }
      }
    });

    const msgsQ = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubMsgs = onSnapshot(msgsQ, (snap) => {
      const list: Message[] = snap.docs.map((d) => {
        const m = d.data() as any;
        return {
          id: d.id,
          chatId,
          senderId: m.senderId,
          type: m.type,
          text: m.text,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType,
          fileName: m.fileName,
          fileSize: m.fileSize,
          replyToMessageId: m.replyToMessageId ?? null,
          editedAt: m.editedAt?.toDate ? m.editedAt.toDate() : null,
          list_of_lovers: m.list_of_lovers ?? [],
          createdAt: m.createdAt?.toDate ? m.createdAt.toDate() : null,
        };
      });
      setMessages(list);
    });

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [chatId, profile?.id]);

  // Advertise typing on input changes with debounce auto-clear
  const handleInputChange = (text: string) => {
    setInput(text);

    if (text.trim().length > 0) {
      if (!advertisedTyping) {
        setTypingState('text');
        setTypingLegacy(true);
      }
      clearTypingTimer();
      typingTimeoutRef.current = setTimeout(() => {
        setTypingState(null);
        setTypingLegacy(false);
      }, 3500);
    } else {
      clearTypingTimer();
      if (advertisedTyping) {
        setTypingState(null);
        setTypingLegacy(false);
      }
    }
  };

  const cancelReply = () => setReplyTarget(null);
  const cancelEdit = () => {
    setEditingMessage(null);
    setInput('');
  };

  // Fast map for reply previews
  const messageMap = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  const getSenderName = (m: Message) => {
    if (m.senderId === profile?.id) return 'You';
    return otherUser?.displayName || 'User';
  };

  const buildReplyPreview = (msgId?: string | null) => {
    if (!msgId) return null;
    const target = messageMap.get(msgId);
    if (!target) return null;
    let snippet = '';
    if (target.text?.trim()) snippet = target.text.trim();
    else if (target.mediaType === 'image') snippet = '[image]';
    else if (target.mediaType === 'video') snippet = '[video]';
    else if (target.mediaType === 'audio') snippet = '[audio]';
    else if (target.mediaType === 'file') snippet = target.fileName ? `[file] ${target.fileName}` : '[file]';
    else snippet = '[message]';

    const thumb = target.mediaType === 'image' ? target.mediaUrl : undefined;

    return {
      senderName: getSenderName(target),
      snippet,
      thumbnailUrl: thumb,
    };
  };

  // Send or edit
  const handleSend = async () => {
    if (!profile || !chatId || !input.trim()) return;
    const text = input.trim();

    clearTypingTimer();
    if (advertisedTyping) {
      await setTypingState(null);
      await setTypingLegacy(false);
    }

    // EDIT FLOW
    if (editingMessage && editingMessage.senderId === profile.id) {
      try {
        const msgRef = doc(db, 'chats', chatId, 'messages', editingMessage.id);
        await updateDoc(msgRef, {
          text,
          editedAt: serverTimestamp(),
        });

        // sync last message if this is the most recent
        const last = messages[messages.length - 1];
        if (last && last.id === editingMessage.id) {
          await updateDoc(doc(db, 'chats', chatId), {
            lastMessageText: text,
            lastMessageSenderId: profile.id,
            lastMessageAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        setEditingMessage(null);
        setInput('');
      } catch (e) {
        Alert.alert('Edit failed', 'Could not update your message.');
      }
      return;
    }

    // NEW SEND
    const msgRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(msgRef, {
      senderId: profile.id,
      type: 'text',
      text,
      replyToMessageId: replyTarget ? replyTarget.id : null,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'chats', chatId), {
      lastMessageText: text,
      lastMessageSenderId: profile.id,
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setInput('');
    setReplyTarget(null);
  };

  // Long-press actions: Edit (own, within 15m), Delete, Remind me
  const onLongPressMessage = (m: Message, isOwn: boolean) => {
    const created = m.createdAt ? m.createdAt.getTime() : 0;
    const withinWindow = isOwn && Date.now() - created <= EDIT_WINDOW_MS;

    const buttons: any[] = [];
    buttons.push({
      text: 'Reply',
      onPress: () => setReplyTarget(m),
    });
    if (withinWindow) {
      buttons.push({
        text: 'Edit',
        onPress: () => {
          setEditingMessage(m);
          setReplyTarget(null);
          setInput(m.text || '');
        },
      });
    }
    buttons.push({
      text: 'Remind me…',
      onPress: () => setReminderTarget(m),
    });
    if (isOwn) {
      buttons.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => setMessageToDelete(m),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message', 'Choose an action', buttons, { cancelable: true });
  };

  // Delete message
  const handleDeleteMessage = async () => {
    if (!chatId || !messageToDelete || !profile) return;

    if (messageToDelete.senderId !== profile.id) {
      setMessageToDelete(null);
      return;
    }

    setDeletingMessage(true);

    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageToDelete.id));

      // Recalculate last message
      const lastQ = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const lastSnap = await getDocs(lastQ);

      if (lastSnap.empty) {
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessageText: '',
          lastMessageSenderId: null,
          lastMessageAt: null,
          updatedAt: serverTimestamp(),
        });
      } else {
        const last = lastSnap.docs[0].data() as any;
        await updateDoc(doc(db, 'chats', chatId), {
          lastMessageText: last.text ?? '',
          lastMessageSenderId: last.senderId,
          lastMessageAt: last.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.warn('Error deleting message', e);
    } finally {
      setDeletingMessage(false);
      setMessageToDelete(null);
    }
  };

  // Clean up typing on background/leave
  useEffect(() => {
    if (!profile || !chatId) return;

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        clearTypingTimer();
        setTypingState(null);
        setTypingLegacy(false);
      }
    });

    const blurSub = navigation.addListener('blur', () => {
      clearTypingTimer();
      setTypingState(null);
      setTypingLegacy(false);
    });
    const beforeRemoveSub = navigation.addListener('beforeRemove', () => {
      clearTypingTimer();
      setTypingState(null);
      setTypingLegacy(false);
    });

    return () => {
      appSub.remove();
      blurSub();
      beforeRemoveSub();
      clearTypingTimer();
      setTypingState(null);
      setTypingLegacy(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, profile?.id]);

  const bgUri = chat?.backgroundImageUrl;

  // Typing subtitle based on typingStates (fallback to legacy)
  const getTitle = () => {
    if (chat?.type === 'group') return chat.title ?? 'Group';
    if (otherUser) return otherUser.displayName;
    return 'Chat';
  };

  const getTypingString = (mode: TypingMode) => {
    if (mode === 'audio') return 'recording a voice…';
    if (mode === 'photo') return 'choosing a photo…';
    return 'typing…';
  };

  const getSubtitle = () => {
    const myId = profile?.id;
    const members = chat?.memberIds ?? [];
    const ts = chat?.typingStates ?? {};
    const legacy = chat?.typingUserIds ?? [];

    if (chat?.type === 'direct') {
      const isSelf = members.length > 0 && members.every((id) => id === myId);
      const otherId = members.find((id) => id !== myId);
      if (!otherId) {
        if (isSelf && myId && (ts[myId] || legacy.includes(myId))) {
          return getTypingString(ts[myId] || 'text');
        }
        return '';
      }
      if (ts[otherId]) return getTypingString(ts[otherId]!);
      if (legacy.includes(otherId)) return 'typing…';
    } else if (chat?.type === 'group') {
      const others = members.filter((id) => id !== myId);
      const active = others.filter((id) => !!ts[id]);
      if (active.length > 0) {
        if (active.length === 1) return getTypingString(ts[active[0]]!);
        return 'Several people are typing…';
      }
      const othersLegacy = legacy.filter((id) => id !== myId);
      if (othersLegacy.length > 0) {
        return othersLegacy.length > 1 ? 'Several people are typing…' : 'Someone is typing…';
      }
      return `${members.length} participants`;
    }

    if (otherUser) {
      if (otherUser.online) return 'online';
      if (otherUser.lastSeen) {
        return `last seen at ${otherUser.lastSeen.toLocaleString()}`;
      }
    }
    return '';
  };

  // Swipe left action visual for reply
  const renderLeftReplyAction = () => (
    <View
      style={{
        width: 72,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E6EEFF',
        borderRadius: 12,
        marginLeft: spacing.md,
      }}
    >
      <Ionicons name="arrow-undo-outline" size={20} color={colors.primary} />
      <Text style={{ color: colors.primary, fontSize: 11, marginTop: 4 }}>Reply</Text>
    </View>
  );

  // Quick helper to advertise “photo” typing when opening media picker (hook this into your picker)
  const announceChoosingPhoto = () => {
    setTypingState('photo');
    setTypingLegacy(true);
    setTimeout(() => {
      setTypingState(null);
      setTypingLegacy(false);
    }, 5000);
  };

  // ---- Reminders
  // inside ChatScreen.tsx

const scheduleReminderAt = async (at: Date, m: Message) => {
  if (!profile || !chatId) return;

  // validate & nudge to the future
  if (!(at instanceof Date) || isNaN(at.getTime())) {
    Alert.alert('Invalid time', 'Please pick a valid date/time.');
    return;
  }
  if (at.getTime() <= Date.now()) {
    at = new Date(Date.now() + 2000);
  }

  // ✅ Use a DateTriggerInput (type is REQUIRED by the TS defs)
  const trigger: Notifications.DateTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: at,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  };

  const notifId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Reminder from ${getTitle()}`,
      body: m.text ? m.text.slice(0, 80) : '[message]',
      data: { chatId, messageId: m.id },
    },
    trigger,
  });

  await addDoc(collection(db, 'reminders', profile.id, 'items'), {
    chatId,
    messageId: m.id,
    at,
    scheduledNotificationId: notifId,
    createdAt: new Date(),
  });

  setReminderTarget(null);
  Alert.alert('Scheduled', 'I’ll remind you at the selected time.');
};


  const schedulePreset = (mins: number) => {
    if (!reminderTarget) return;
    const when = new Date(Date.now() + mins * 60 * 1000);
    scheduleReminderAt(when, reminderTarget);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>

        {/* Tappable name → settings */}
        <Pressable
          onPress={() => {
            if (!chat) return;
            if (chat.type === 'group') {
              navigation.navigate('GroupSettings', { chatId: chat.id });
            } else {
              navigation.navigate('DirectChatSettings', { chatId: chat.id });
            }
          }}
          style={{
            marginLeft: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <Avatar
            name={getTitle()}
            uri={chat?.type === 'group' ? chat?.avatarUrl : otherUser?.avatarUrl}
            size={36}
          />
          <View style={{ marginLeft: spacing.sm }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: '600',
              }}
              numberOfLines={1}
            >
              {getTitle()}
            </Text>
            {getSubtitle() ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {getSubtitle()}
              </Text>
            ) : null}
          </View>
        </Pressable>

        {chat?.type === 'group' ? (
          <Pressable
            style={{ marginLeft: 'auto' }}
            onPress={() => navigation.navigate('GroupSettings', { chatId: chat?.id })}
          >
            <Ionicons
              name="information-circle-outline"
              size={24}
              color={colors.textPrimary}
            />
          </Pressable>
        ) : null}
      </View>

      {/* Messages + optional background */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        {chat?.backgroundImageUrl ? (
          <ImageBackground
            source={{ uri: chat.backgroundImageUrl }}
            style={{ flex: 1 }}
            imageStyle={{ opacity: 0.25 }}
          >
            <FlatList
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                const isOwn = item.senderId === profile?.id;
                const showDetails = expandedMessageId === item.id;
                const replyPreview = buildReplyPreview(item.replyToMessageId);

                return (
                  <Swipeable
                    renderLeftActions={renderLeftReplyAction}
                    overshootLeft={false}
                    onSwipeableOpen={(dir) => {
                      if (dir === 'left') setReplyTarget(item);
                    }}
                  >
                    <MessageBubble
                      message={item}
                      isOwn={isOwn}
                      showDetails={showDetails}
                      replyPreview={replyPreview as any}
                      onPress={() =>
                        setExpandedMessageId((prev) => (prev === item.id ? null : item.id))
                      }
                      onLongPress={() => onLongPressMessage(item, isOwn)}
                    />
                  </Swipeable>
                );
              }}
              contentContainerStyle={{ paddingVertical: spacing.md, paddingHorizontal: spacing.sm }}
            />
          </ImageBackground>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isOwn = item.senderId === profile?.id;
              const showDetails = expandedMessageId === item.id;
              const replyPreview = buildReplyPreview(item.replyToMessageId);

              return (
                <Swipeable
                  renderLeftActions={renderLeftReplyAction}
                  overshootLeft={false}
                  onSwipeableOpen={(dir) => {
                    if (dir === 'left') setReplyTarget(item);
                  }}
                >
                  <MessageBubble
                    message={item}
                    isOwn={isOwn}
                    showDetails={showDetails}
                    replyPreview={replyPreview as any}
                    onPress={() =>
                      setExpandedMessageId((prev) => (prev === item.id ? null : item.id))
                    }
                    onLongPress={() => onLongPressMessage(item, isOwn)}
                  />
                </Swipeable>
              );
            }}
            contentContainerStyle={{ paddingVertical: spacing.md }}
          />
        )}

        {/* Reply / Edit banners */}
        {(replyTarget || editingMessage) && (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              backgroundColor: colors.background,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            {replyTarget ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="arrow-undo-outline" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}
                  >
                    Replying to {getSenderName(replyTarget)}
                  </Text>
                  <Text
                    style={{ color: colors.textSecondary, fontSize: 12 }}
                    numberOfLines={1}
                  >
                    {buildReplyPreview(replyTarget.id)?.snippet}
                  </Text>
                </View>
                <Pressable onPress={cancelReply} hitSlop={8}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}

            {editingMessage ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginTop: replyTarget ? 8 : 0,
                }}
              >
                <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                  Editing message (15-min window)
                </Text>
                <Pressable onPress={cancelEdit} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="close" size={16} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {/* Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.backgroundElevated,
          }}
        >
          <Pressable
            onPress={() => {
              // hook this into your media picker, we just advertise state for now
              announceChoosingPhoto();
              // open picker…
            }}
            style={{ marginRight: spacing.sm }}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.primarySoft} />
          </Pressable>

          <TextInput
            placeholder={editingMessage ? 'Edit message' : 'Type a message'}
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
              marginRight: spacing.sm,
            }}
            value={input}
            onChangeText={handleInputChange}
            onBlur={() => {
              clearTypingTimer();
              if (advertisedTyping) {
                setTypingState(null);
                setTypingLegacy(false);
              }
            }}
          />

          <Pressable onPress={handleSend}>
            <Ionicons name="send" size={24} color={colors.primary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Delete confirmation */}
      <ConfirmModal
        visible={!!messageToDelete}
        title="Delete your message?"
        message={
          deletingMessage
            ? 'Deleting message...'
            : 'This message will be permanently removed from the conversation.'
        }
        confirmText={deletingMessage ? 'Deleting...' : 'Delete'}
        danger
        onCancel={() => (deletingMessage ? null : setMessageToDelete(null))}
        onConfirm={deletingMessage ? () => {} : handleDeleteMessage}
      />

      {/* Reminder quick sheet */}
      <Modal visible={!!reminderTarget} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#00000088',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.lg,
          }}
          onPress={() => setReminderTarget(null)}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 420,
              backgroundColor: colors.background,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View style={{ padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 16 }}>
                Remind me about this
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {reminderTarget?.text?.slice(0, 80) || '[message]'}
              </Text>
            </View>

            <View style={{ padding: spacing.lg, gap: spacing.sm }}>
              <ReminderOption label="In 15 minutes" onPress={() => schedulePreset(15)} />
              <ReminderOption label="In 1 hour" onPress={() => schedulePreset(60)} />
              <ReminderOption label="In 3 hours" onPress={() => schedulePreset(3 * 60)} />
              <ReminderOption label="Tomorrow morning (9:00)" onPress={() => {
                const t = new Date();
                t.setDate(t.getDate() + 1);
                t.setHours(9, 0, 0, 0);
                scheduleReminderAt(t, reminderTarget!);
              }} />
            </View>

            <Pressable
              onPress={() => setReminderTarget(null)}
              style={{
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

function ReminderOption({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundElevated,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export default ChatScreen;
