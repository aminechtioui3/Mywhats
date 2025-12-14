import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme';
import { Chat, UserProfile } from '../../types';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';

interface Params {
  chatId: string;
}

interface JoinRequest {
  id: string;
  requesterId: string;
  createdAt?: Date | null;
}

const GroupSettingsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const navigation: any = useNavigation();
  const { chatId } = route.params as Params;
  const { profile } = useAuth();

  const [chat, setChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Confirm modals state
  const [confirmExitVisible, setConfirmExitVisible] = useState(false);
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);
  const [confirmMakeAdminUserId, setConfirmMakeAdminUserId] = useState<string | null>(null);

  const [working, setWorking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'chats', chatId));
        if (!snap.exists()) return;

        const c = snap.data() as any;
        const mapped: Chat = {
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
          inviteCode: c.inviteCode ?? null,
          inviteExpiresAt: c.inviteExpiresAt?.toDate ? c.inviteExpiresAt.toDate() : c.inviteExpiresAt ?? null,
          joinApprovalRequired: c.joinApprovalRequired ?? false,
        };
        setChat(mapped);

        const users: UserProfile[] = [];
        for (const uid of mapped.memberIds) {
          const usnap = await getDoc(doc(db, 'users', uid));
          if (usnap.exists()) {
            const d = usnap.data() as any;
            users.push({
              id: usnap.id,
              phone: d.phone,
              displayName: d.displayName ?? d.phone,
              avatarUrl: d.avatarUrl,
              statusMessage: d.statusMessage,
              lastSeen: d.lastSeen?.toDate ? d.lastSeen.toDate() : null,
              online: d.online,
            });
          }
        }
        setMembers(users);

        // load pending join requests if approval is enabled
        if (mapped.joinApprovalRequired) {
          const rs = await getDocs(collection(db, 'chats', chatId, 'joinRequests'));
          const list: JoinRequest[] = rs.docs.map((d) => {
            const x = d.data() as any;
            return {
              id: d.id,
              requesterId: x.requesterId,
              createdAt: x.createdAt?.toDate ? x.createdAt.toDate() : null,
            };
          });
          setRequests(list);
        } else {
          setRequests([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [chatId]);

  const isAdmin = !!(chat && profile && chat.adminId === profile.id);

  const handleMakeAdmin = async (userId: string) => {
    if (!chat) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, 'chats', chat.id), { adminId: userId });
      setChat({ ...chat, adminId: userId });
    } finally {
      setWorking(false);
      setConfirmMakeAdminUserId(null);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!chat) return;
    setWorking(true);
    try {
      const newMembers = chat.memberIds.filter((id) => id !== userId);
      await updateDoc(doc(db, 'chats', chat.id), { memberIds: newMembers });
      setChat({ ...chat, memberIds: newMembers });
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } finally {
      setWorking(false);
      setConfirmRemoveUserId(null);
    }
  };

  const handleExitGroup = async () => {
    if (!chat || !profile) return;
    setWorking(true);
    try {
      const newMembers = chat.memberIds.filter((id) => id !== profile.id);
      const updates: any = { memberIds: newMembers };
      if (chat.adminId === profile.id && newMembers.length > 0) {
        // hand admin to first remaining member
        updates.adminId = newMembers[0];
      }
      await updateDoc(doc(db, 'chats', chat.id), updates);
      navigation.goBack();
    } finally {
      setWorking(false);
      setConfirmExitVisible(false);
    }
  };

  const generateCode = (len = 10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };

  const setInvite = async (enable: boolean) => {
    if (!chat) return;
    if (!enable) {
      await updateDoc(doc(db, 'chats', chat.id), { inviteCode: null, inviteExpiresAt: null });
      setChat({ ...chat, inviteCode: null, inviteExpiresAt: null });
      return;
    }
    const code = generateCode();
    const expires = null; // or set a date in future
    await updateDoc(doc(db, 'chats', chat.id), {
      inviteCode: code,
      inviteExpiresAt: expires,
      updatedAt: serverTimestamp(),
    });
    setChat({ ...chat, inviteCode: code, inviteExpiresAt: null });
  };

  const toggleApproval = async (next: boolean) => {
    if (!chat) return;
    await updateDoc(doc(db, 'chats', chat.id), {
      joinApprovalRequired: next,
      updatedAt: serverTimestamp(),
    });
    setChat({ ...chat, joinApprovalRequired: next });
    if (!next) setRequests([]);
  };

  const approveRequest = async (r: JoinRequest) => {
    if (!chat) return;
    setWorking(true);
    try {
      if (!chat.memberIds.includes(r.requesterId)) {
        const updated = [...chat.memberIds, r.requesterId];
        await updateDoc(doc(db, 'chats', chat.id), { memberIds: updated, updatedAt: serverTimestamp() });
        setChat({ ...chat, memberIds: updated });
      }
      await deleteDoc(doc(db, 'chats', chat.id, 'joinRequests', r.id));
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setWorking(false);
    }
  };

  const declineRequest = async (r: JoinRequest) => {
    if (!chat) return;
    setWorking(true);
    try {
      await deleteDoc(doc(db, 'chats', chat.id, 'joinRequests', r.id));
      setRequests((prev) => prev.filter((x) => x.id !== r.id));
    } finally {
      setWorking(false);
    }
  };

  if (loading || !chat) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg }}>
          <HeaderBar title="Group settings" onBack={() => navigation.goBack()} />
          <View style={{ marginTop: spacing.lg, height: 140, backgroundColor: colors.backgroundElevated, borderRadius: radius.xl }} />
        </View>
      </SafeAreaView>
    );
  }

  const DEEPLINK_BASE = 'myapp://join?code='; // configure
  const WEB_BASE = 'https://yourapp.example/join?c='; // configure
  const inviteLink = chat.inviteCode ? `${WEB_BASE}${chat.inviteCode}` : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <HeaderBar title="Group settings" onBack={() => navigation.goBack()} />

      {/* Group hero card */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing.lg,
          backgroundColor: colors.backgroundElevated,
          borderRadius: radius.xl,
          padding: spacing.lg,
          elevation: 3,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        <Avatar name={chat.title ?? 'Group'} uri={chat.avatarUrl} size={56} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>
            {chat.title ?? 'Group'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
            {members.length} participants {isAdmin ? '• You are admin' : ''}
          </Text>
        </View>

        {/* Exit */}
        <Pressable
          onPress={() => setConfirmExitVisible(true)}
          android_ripple={{ color: '#00000010', borderless: true }}
          style={{
            borderRadius: 100,
            borderWidth: 1,
            borderColor: colors.danger,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            backgroundColor: '#FFF5F5',
          }}
        >
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Exit</Text>
        </Pressable>
      </View>

      {/* Invite + approval controls */}
      {isAdmin && (
        <View style={{ marginTop: spacing.lg, marginHorizontal: spacing.lg, gap: spacing.md }}>
          <CardRow
            title="Invite link"
            subtitle={
              chat.inviteCode
                ? inviteLink
                : 'Generate a link and QR for others to join'
            }
            right={
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {chat.inviteCode ? (
                  <>
                    <IconPill
                      icon="copy-outline"
                      label="Copy"
                      onPress={() => {
                        Alert.alert('Invite link', inviteLink);
                      }}
                    />
                    <IconPill
                      icon="qr-code-outline"
                      label="QR"
                      onPress={() => navigation.navigate('GroupInvite', { chatId: chat.id })}
                    />
                    <IconPill
                      icon="close-circle-outline"
                      label="Revoke"
                      danger
                      onPress={() => setInvite(false)}
                    />
                  </>
                ) : (
                  <IconPill
                    icon="link-outline"
                    label="Generate"
                    onPress={() => setInvite(true)}
                  />
                )}
              </View>
            }
          />

          <CardRow
            title="Join approval required"
            subtitle="New members must be approved before joining"
            right={
              <Switch
                value={!!chat.joinApprovalRequired}
                onValueChange={toggleApproval}
              />
            }
          />
        </View>
      )}

      {/* Pending requests (admin only & approval on) */}
      {isAdmin && chat.joinApprovalRequired && (
        <>
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase' }}>
              Pending requests
            </Text>
          </View>
          <FlatList
            data={requests}
            keyExtractor={(x) => x.id}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            renderItem={({ item }) => (
              <View
                style={{
                  marginHorizontal: spacing.lg,
                  marginTop: spacing.sm,
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                }}
              >
                <Ionicons name="person-add-outline" size={20} color={colors.textPrimary} />
                <Text style={{ flex: 1, color: colors.textPrimary }}>
                  {item.requesterId}
                </Text>
                <IconPill icon="checkmark-circle-outline" label="Approve" onPress={() => approveRequest(item)} />
                <IconPill icon="close-circle-outline" label="Decline" danger onPress={() => declineRequest(item)} />
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }}>
                {requests.length === 0 ? 'No pending requests.' : ''}
              </Text>
            }
          />
        </>
      )}

      {/* Members header */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          Members
        </Text>
      </View>

      {/* Members list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        renderItem={({ item }) => {
          const isMemberAdmin = chat.adminId === item.id;
          return (
            <View
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                backgroundColor: colors.backgroundElevated,
                borderRadius: radius.lg,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
                elevation: 2,
                shadowColor: '#000',
                shadowOpacity: 0.03,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
              }}
            >
              <Avatar name={item.displayName} uri={item.avatarUrl} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Badge text={isMemberAdmin ? 'Admin' : 'Member'} type={isMemberAdmin ? 'primary' : 'neutral'} />
                  {item.online ? <Badge text="online" type="success" /> : null}
                </View>
              </View>

              {isAdmin && !isMemberAdmin && (
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <IconPill
                    icon="star-outline"
                    label="Make admin"
                    onPress={() => setConfirmMakeAdminUserId(item.id)}
                  />
                  <IconPill
                    icon="remove-circle-outline"
                    label="Remove"
                    danger
                    onPress={() => setConfirmRemoveUserId(item.id)}
                  />
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>
            No members.
          </Text>
        }
      />

      {/* Confirm: Make admin */}
      <ConfirmModal
        visible={!!confirmMakeAdminUserId}
        title="Make admin?"
        message={
          working
            ? 'Updating admin...'
            : 'This member will become the group admin.'
        }
        confirmText={working ? 'Updating…' : 'Make admin'}
        onCancel={() => (working ? null : setConfirmMakeAdminUserId(null))}
        onConfirm={working ? () => {} : () => handleMakeAdmin(confirmMakeAdminUserId!)}
      />

      {/* Confirm: Remove member */}
      <ConfirmModal
        visible={!!confirmRemoveUserId}
        title="Remove member?"
        message={
          working
            ? 'Removing member...'
            : 'This member will be removed from the group.'
        }
        confirmText={working ? 'Removing…' : 'Remove'}
        danger
        onCancel={() => (working ? null : setConfirmRemoveUserId(null))}
        onConfirm={working ? () => {} : () => handleRemoveMember(confirmRemoveUserId!)}
      />

      {/* Confirm: Exit group */}
      <ConfirmModal
        visible={confirmExitVisible}
        title="Leave this group?"
        message={
          working
            ? 'Leaving group...'
            : 'You will no longer receive messages from this group. If you are the admin, admin role will be transferred.'
        }
        confirmText={working ? 'Leaving…' : 'Exit'}
        danger
        onCancel={() => (working ? null : setConfirmExitVisible(false))}
        onConfirm={working ? () => {} : handleExitGroup}
      />
    </SafeAreaView>
  );
};

export default GroupSettingsScreen;

/* ---------- */
/* Subcomponents (UI) */
/* ---------- */

function HeaderBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Pressable
        onPress={onBack}
        android_ripple={{ color: '#00000010', borderless: true }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#F8FAFF',
          elevation: 2,
          shadowColor: '#000',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
      </Pressable>

      <Text
        numberOfLines={1}
        style={{
          color: colors.textPrimary,
          fontSize: typography.h2,
          fontWeight: '800',
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function Badge({ text, type = 'neutral' }: { text: string; type?: 'neutral' | 'primary' | 'success' }) {
  const palette =
    type === 'primary'
      ? { bg: '#EEF2FF', fg: colors.primary, border: '#DDE3FF' }
      : type === 'success'
      ? { bg: '#ECFDF5', fg: '#065F46', border: '#D1FAE5' }
      : { bg: '#F5F7FB', fg: colors.textSecondary, border: '#E7ECF5' };

  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 12, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

function IconPill({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#00000010', borderless: true }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.border,
        backgroundColor: danger ? '#FFF5F5' : colors.background,
      }}
    >
      <Ionicons
        name={icon}
        size={16}
        color={danger ? colors.danger : colors.textPrimary}
      />
      <Text
        style={{
          color: danger ? colors.danger : colors.textPrimary,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CardRow({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.backgroundElevated,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
