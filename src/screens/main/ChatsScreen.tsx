// src/screens/main/ChatsScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import { Chat, TypingMode, UserProfile } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import Avatar from '../../components/Avatar';
import ConfirmModal from '../../components/ConfirmModal';

// ----- Helpers

const getTypingString = (mode: TypingMode) => {
  if (mode === 'audio') return 'recording a voice…';
  if (mode === 'photo') return 'choosing a photo…';
  return 'typing…';
};

const formatWhen = (d?: Date | null) => {
  if (!d) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString();
};

// ----- Screen

const ChatsScreen: React.FC = () => {
  const { profile } = useAuth();
  const navigation: any = useNavigation();

  const [rows, setRows] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // for direct chats: cache other members' profiles
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});

  // leave group confirm
  const [confirmLeaveChat, setConfirmLeaveChat] = useState<Chat | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Subscribe to my chats
  useEffect(() => {
    if (!profile?.id) return;

    // Prefer ordering by updatedAt desc (requires Firestore index); if your
    // project has no index yet, Firestore console will show a link the first time.
    const q = query(
      collection(db, 'chats'),
      where('memberIds', 'array-contains', profile.id),
      orderBy('updatedAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Chat[] = snap.docs.map((d) => {
          const c = d.data() as any;
          return {
            id: d.id,
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
            typingUserIds: c.typingUserIds ?? [], // legacy fallback
            backgroundImageUrl: c.backgroundImageUrl,
          } as Chat;
        });
        setRows(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[ChatsScreen] snapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [profile?.id]);

  // Fetch other users used in current rows (for direct chats)
  useEffect(() => {
    const load = async () => {
      if (!profile?.id) return;
      const needed: string[] = [];
      for (const ch of rows) {
        if (ch.type === 'direct') {
          const otherId = ch.memberIds.find((id) => id !== profile.id);
          if (otherId && !userCache[otherId]) needed.push(otherId);
        }
      }
      if (needed.length === 0) return;

      const newCache: Record<string, UserProfile> = {};
      await Promise.all(
        needed.map(async (uid) => {
          const s = await getDoc(doc(db, 'users', uid));
          if (s.exists()) {
            const d = s.data() as any;
            newCache[uid] = {
              id: s.id,
              phone: d.phone ?? '',
              displayName: d.displayName ?? d.phone ?? 'User',
              avatarUrl: d.avatarUrl ?? '',
              statusMessage: d.statusMessage,
              lastSeen: d.lastSeen?.toDate ? d.lastSeen.toDate() : null,
              online: d.online ?? false,
              favoriteChatIds: [],
              favoriteContactIds: [],
              createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : null,
            };
          }
        })
      );
      if (Object.keys(newCache).length > 0) {
        setUserCache((prev) => ({ ...prev, ...newCache }));
      }
    };
    load();
  }, [rows, profile?.id, userCache]);

  const onRefresh = useCallback(() => {
    // onSnapshot already live-updates; this just gives visual feedback
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Filtered rows (search by title or direct contact name)
  const data = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((ch) => {
      const base = ch.title?.toLowerCase() ?? '';
      if (base.includes(term)) return true;
      if (ch.type === 'direct' && profile?.id) {
        const otherId = ch.memberIds.find((id) => id !== profile.id);
        const otherName = otherId ? userCache[otherId]?.displayName?.toLowerCase() : '';
        return otherName?.includes(term);
      }
      return false;
    });
  }, [rows, search, profile?.id, userCache]);

  const renderSubtitle = (ch: Chat): string => {
    // typing states first
    const ts: Record<string, TypingMode> = (ch as any).typingStates ?? {};
    const legacy: string[] = (ch as any).typingUserIds ?? [];
    const myId = profile?.id;

    if (ch.type === 'direct') {
      const otherId = ch.memberIds.find((id) => id !== myId);
      if (otherId && ts[otherId]) return getTypingString(ts[otherId]);
      if (otherId && legacy.includes(otherId)) return 'typing…';
    } else {
      // group: if multiple typing → generic
      const others = ch.memberIds.filter((id) => id !== myId);
      const active = others.filter((id) => !!ts[id]);
      if (active.length > 1) return 'Several people are typing…';
      if (active.length === 1) return getTypingString(ts[active[0]]);
      const othersLegacy = legacy.filter((id) => id !== myId);
      if (othersLegacy.length > 0) return othersLegacy.length > 1 ? 'Several people are typing…' : 'Someone is typing…';
    }

    // otherwise last message
    const preview = ch.lastMessageText?.trim();
    if (!preview) return 'No messages yet';
    const mine = ch.lastMessageSenderId && ch.lastMessageSenderId === myId;
    return mine ? `You: ${preview}` : preview;
  };

  const getTitle = (ch: Chat): string => {
    if (ch.type === 'group') return ch.title ?? 'Group';
    const myId = profile?.id;
    const otherId = ch.memberIds.find((id) => id !== myId);
    if (!otherId) return 'Saved messages';
    return userCache[otherId]?.displayName ?? 'User';
  };

  const getAvatar = (ch: Chat): { name: string; uri?: string } => {
    if (ch.type === 'group') return { name: getTitle(ch), uri: ch.avatarUrl };
    const myId = profile?.id;
    const otherId = ch.memberIds.find((id) => id !== myId);
    if (!otherId) return { name: 'Saved messages', uri: undefined };
    return { name: userCache[otherId]?.displayName ?? 'User', uri: userCache[otherId]?.avatarUrl };
  };

  const onPressRow = (ch: Chat) => {
    console.log("hi");
    navigation.navigate('Chat', { chatId: ch.id });
  };

  const onLongPressRow = (ch: Chat) => {
    if (ch.type !== 'group') return; // only group action for now
    setConfirmLeaveChat(ch);
  };

  const leaveGroup = async (ch: Chat) => {
    if (!profile?.id) return;
    setLeaving(true);
    try {
      const others = ch.memberIds.filter((id) => id !== profile.id);
      const updates: any = { memberIds: others };
      if (ch.adminId === profile.id && others.length > 0) {
        updates.adminId = others[0];
      }
      await updateDoc(doc(db, 'chats', ch.id), updates);
      setConfirmLeaveChat(null);
    } catch (e) {
      console.warn('[ChatsScreen] leave error:', e);
      Alert.alert('Error', 'Could not leave this group.');
    } finally {
      setLeaving(false);
    }
  };

  const Empty = () => (
    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
      <Text style={{ color: colors.textMuted }}>No chats yet. Start a new one!</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
          backgroundColor: colors.background,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Text style={{ color: colors.textPrimary, fontSize: typography.h2, fontWeight: '800', flex: 1 }}>
          Chats
        </Text>

        <Pressable onPress={() => navigation.navigate('NewChat')} android_ripple={{ color: '#00000010', borderless: true }}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.lg,
            backgroundColor: colors.backgroundElevated,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search"
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              height: 44,
              paddingLeft: spacing.sm,
              color: colors.textPrimary,
            }}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={!loading ? <Empty /> : null}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        renderItem={({ item }) => {
          const title = getTitle(item);
          const subtitle = renderSubtitle(item);
          const when = formatWhen(item.lastMessageAt || item.updatedAt || item.createdAt);
          const av = getAvatar(item);

          return (
            <Pressable
              onPress={() => onPressRow(item)}
              onLongPress={() => onLongPressRow(item)}
              android_ripple={{ color: '#00000010' }}
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                backgroundColor: colors.backgroundElevated,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                elevation: 2,
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Avatar name={av.name} uri={av.uri} size={48} />

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '700', flex: 1 }}
                  >
                    {title}
                  </Text>
                  {!!when && (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: spacing.sm }}>
                      {when}
                    </Text>
                  )}
                </View>

                <Text numberOfLines={1} style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {subtitle}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />

      {/* Leave group confirm */}
      <ConfirmModal
        visible={!!confirmLeaveChat}
        title="Leave this group?"
        message={leaving ? 'Leaving group...' : 'You will no longer receive messages from this group.'}
        confirmText={leaving ? 'Leaving…' : 'Leave group'}
        danger
        onCancel={() => (leaving ? null : setConfirmLeaveChat(null))}
        onConfirm={
          leaving || !confirmLeaveChat ? () => {} : () => leaveGroup(confirmLeaveChat)
        }
      />
    </SafeAreaView>
  );
};

export default ChatsScreen;
