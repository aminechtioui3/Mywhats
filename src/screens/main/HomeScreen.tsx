// src/screens/main/HomeScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import { Call, Chat, Contact } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import ContactListItem from '../../components/ContactListItem';
import ChatListItem from '../../components/ChatListItem';
import FloatingActionButton from '../../components/FloatingActionButton';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Avatar from '../../components/Avatar';

const HomeScreen: React.FC = () => {
  const { profile } = useAuth();
  const navigation: any = useNavigation();

  // Data
  const [favoriteContacts, setFavoriteContacts] = useState<Contact[]>([]);
  const [favoriteChats, setFavoriteChats] = useState<Chat[]>([]);
  const [recentCalls, setRecentCalls] = useState<Call[]>([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;

    const load = async () => {
      setLoading(true);
      try {
        // Get pinned ids from user profile
        const userRef = doc(collection(db, 'users'), profile.id);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          setFavoriteContacts([]);
          setFavoriteChats([]);
          setRecentCalls([]);
          setLoading(false);
          return;
        }

        const data = snap.data() as any;
        const favoriteContactIds: string[] = data.favoriteContactIds ?? [];
        const favoriteChatIds: string[] = data.favoriteChatIds ?? [];

        // Favorite contacts (read from subcollection for user-specific name/avatar)
        const contactsCol = collection(db, 'users', profile.id, 'contacts');
        if (favoriteContactIds.length) {
          const favoriteDocs = await Promise.all(
            favoriteContactIds.slice(0, 10).map(async (id) => {
              const docRef = doc(contactsCol, id);
              const cSnap = await getDoc(docRef);
              if (!cSnap.exists()) return null;
              const cData = cSnap.data() as any;
              const contact: Contact = {
                id: cSnap.id,
                contactUserId: cData.contactUserId,
                displayName: cData.displayName,
                phone: cData.phone,
                avatarUrl: cData.avatarUrl,
                isFavorite: true,
                createdAt: cData.createdAt?.toDate ? cData.createdAt.toDate() : null,
              };
              return contact;
            })
          );
          setFavoriteContacts(favoriteDocs.filter(Boolean) as Contact[]);
        } else {
          setFavoriteContacts([]);
        }

        // Favorite chats (pin groups or DMs)
        if (favoriteChatIds.length) {
          const chatsSnap = await getDocs(
            query(
              collection(db, 'chats'),
              where('__name__', 'in', favoriteChatIds.slice(0, 10))
            )
          );
          const chats: Chat[] = chatsSnap.docs.map((d) => {
            const cData = d.data() as any;
            return {
              id: d.id,
              type: cData.type,
              title: cData.title,
              avatarUrl: cData.avatarUrl,
              memberIds: cData.memberIds ?? [],
              adminId: cData.adminId,
              lastMessageText: cData.lastMessageText,
              lastMessageSenderId: cData.lastMessageSenderId,
              lastMessageAt: cData.lastMessageAt?.toDate ? cData.lastMessageAt.toDate() : null,
              createdById: cData.createdById,
              createdAt: cData.createdAt?.toDate ? cData.createdAt.toDate() : null,
              updatedAt: cData.updatedAt?.toDate ? cData.updatedAt.toDate() : null,
            };
          });
          setFavoriteChats(chats);
        } else {
          setFavoriteChats([]);
        }

        // Recent calls (read-only preview)
        const callsQ = query(
          collection(db, 'calls'),
          where('participants', 'array-contains', profile.id),
          orderBy('startedAt', 'desc'),
          limit(15)
        );
        const callsSnap = await getDocs(callsQ);
        const calls: Call[] = callsSnap.docs.map((d) => {
          const c = d.data() as any;
          return {
            id: d.id,
            participants: c.participants ?? [],
            fromUserId: c.fromUserId,
            toUserId: c.toUserId,
            type: c.type,
            status: c.status,
            startedAt: c.startedAt?.toDate ? c.startedAt.toDate() : null,
            endedAt: c.endedAt?.toDate ? c.endedAt.toDate() : null,
          };
        });
        setRecentCalls(calls);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.id]);

  // Search across favorites
  const filteredFavoriteContacts = useMemo(
    () =>
      favoriteContacts.filter((c) =>
        c.displayName.toLowerCase().includes(search.toLowerCase())
      ),
    [favoriteContacts, search]
  );

  const filteredFavoriteGroups = useMemo(
    () =>
      favoriteChats
        .filter((c) => c.type === 'group')
        .filter((c) =>
          (c.title ?? 'Group').toLowerCase().includes(search.toLowerCase())
        ),
    [favoriteChats, search]
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Soft background accents */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -90,
          right: -70,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: '#F1F5FF',
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 140,
          left: -110,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: '#F8FAFF',
        }}
      />

      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: typography.h2,
            fontWeight: '800',
            marginBottom: 4,
            letterSpacing: 0.3,
          }}
        >
          {profile?.displayName ? `Welcome, ${profile.displayName}` : 'Home'}
        </Text>
        <Text style={{ color: colors.textSecondary, marginBottom: spacing.md }}>
          Favorite people, groups and your recent calls.
        </Text>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.backgroundElevated,
            borderRadius: radius.xl,
            paddingHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.textMuted}
            style={{ marginRight: spacing.sm }}
          />
          <TextInput
            placeholder="Search favorites…"
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              color: colors.textPrimary,
            }}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Quick actions */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.md,
          }}
        >
          <PillButton
            icon="chatbubbles-outline"
            label="New chat"
            onPress={() => navigation.navigate('NewChat')}
          />
          <PillButton
            icon="people-outline"
            label="New group"
            onPress={() => navigation.navigate('NewChat')}
          />
          <PillButton
            icon="person-add-outline"
            label="Add contact"
            onPress={() => navigation.navigate('ContactsTab')}
          />
        </View>
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Favorite Contacts */}
        <SectionHeader
          title="Favorite contacts"
          onSeeAll={() => navigation.navigate('ContactsTab')}
        />
        {loading ? (
          <HorizontalSkeleton />
        ) : filteredFavoriteContacts.length === 0 ? (
          <EmptyHint text="You don’t have favorite contacts yet." />
        ) : (
          <FlatList
            horizontal
            data={filteredFavoriteContacts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg }}
            ItemSeparatorComponent={() => <View style={{ width: spacing.sm }} />}
            renderItem={({ item }) => (
              <ContactBubble
                contact={item}
                onOpenChat={() =>
                  navigation.navigate('Chat', {
                    chatId: null,
                    contactUserId: item.contactUserId,
                  })
                }
                onOpenInfo={() =>
                  navigation.navigate('ContactDetails', {
                    contactUserId: item.contactUserId,
                  })
                }
              />
            )}
          />
        )}

        {/* Favorite Groups */}
        <SectionHeader
          title="Favorite groups"
          containerStyle={{ marginTop: spacing.lg }}
          onSeeAll={() => navigation.navigate('ChatsTab')}
        />
        {loading ? (
          <VerticalSkeleton />
        ) : filteredFavoriteGroups.length === 0 ? (
          <EmptyHint text="Pin your favorite groups to see them here." />
        ) : (
          <View style={{ marginTop: spacing.xs }}>
            {filteredFavoriteGroups.map((chat) => (
              <ChatListItem
                key={chat.id}
                title={chat.title ?? 'Group'}
                subtitle={chat.lastMessageText}
                avatarUri={chat.avatarUrl}
                isGroup
                lastMessageTime={
                  chat.lastMessageAt
                    ? chat.lastMessageAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : undefined
                }
                onPress={() => navigation.navigate('Chat', { chatId: chat.id })}
                onAvatarPress={() =>
                  navigation.navigate('GroupSettings', { chatId: chat.id })
                }
              />
            ))}
          </View>
        )}

        {/* Recent Calls */}
        <SectionHeader
          title="Recent calls"
          containerStyle={{ marginTop: spacing.lg }}
          onSeeAll={() => navigation.navigate('ContactsTab')}
        />
        {loading ? (
          <VerticalSkeleton />
        ) : recentCalls.length === 0 ? (
          <EmptyHint text="Your last calls will appear here." />
        ) : (
          <View style={{ marginTop: spacing.xs }}>
            {recentCalls.slice(0, 8).map((call) => (
              <View
                key={call.id}
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.backgroundElevated,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons
                      name={call.type === 'audio' ? 'call-outline' : 'videocam-outline'}
                      size={16}
                      color={colors.textSecondary}
                    />
                  </View>
                  <Text style={{ color: colors.textPrimary }}>
                    {call.type === 'audio' ? 'Audio' : 'Video'} call
                  </Text>
                </View>

                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {call.startedAt
                    ? call.startedAt.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Global FAB (Call) */}
      <FloatingActionButton
        icon={<Ionicons name="call-outline" size={24} color={colors.textPrimary} />}
        onPress={() => navigation.navigate('ContactsTab')}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;

/* ============================= */
/* ------- UI Subcomponents ---- */
/* ============================= */

function SectionHeader({
  title,
  onSeeAll,
  containerStyle,
}: {
  title: string;
  onSeeAll?: () => void;
  containerStyle?: any;
}) {
  return (
    <View
      style={[
        {
          paddingHorizontal: spacing.lg,
          marginTop: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        containerStyle,
      ]}
    >
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        }}
      >
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: colors.backgroundElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
            See all
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function PillButton({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.backgroundElevated,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function ContactBubble({
  contact,
  onOpenChat,
  onOpenInfo,
}: {
  contact: Contact;
  onOpenChat: () => void;
  onOpenInfo: () => void;
}) {
  return (
    <Pressable
      onPress={onOpenChat}
      style={{
        width: 96,
        alignItems: 'center',
        backgroundColor: colors.backgroundElevated,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable onPress={onOpenInfo} hitSlop={8}>
        <Avatar name={contact.displayName} uri={contact.avatarUrl} size={56} />
      </Pressable>
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 12,
          textAlign: 'center',
          marginTop: 6,
        }}
        numberOfLines={2}
      >
        {contact.displayName}
      </Text>
    </Pressable>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Text
      style={{
        color: colors.textMuted,
        fontSize: 12,
        marginLeft: spacing.lg,
        marginTop: spacing.sm,
      }}
    >
      {text}
    </Text>
  );
}

function HorizontalSkeleton() {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 96,
            height: 100,
            backgroundColor: '#F3F6FB',
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: '#E8EEF7',
          }}
        />
      ))}
    </View>
  );
}

function VerticalSkeleton() {
  return (
    <View style={{ gap: 10, paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 56,
            backgroundColor: '#F3F6FB',
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: '#E8EEF7',
          }}
        />
      ))}
    </View>
  );
}
