import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { Chat } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

interface Params {
  chatId: string;
}

const GroupInviteScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const navigation: any = useNavigation();
  const { chatId } = route.params as Params;

  const [chat, setChat] = useState<Chat | null>(null);

  useEffect(() => {
    (async () => {
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
      };
      setChat(mapped);
    })();
  }, [chatId]);

  const WEB_BASE = 'https://yourapp.example/join?c='; // configure
  const value = chat?.inviteCode ? `${WEB_BASE}${chat.inviteCode}` : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFF',
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: typography.h2, fontWeight: '800' }}>Invite</Text>
      </View>

      <View style={{ margin: spacing.lg, backgroundColor: colors.backgroundElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 16 }}>
          {chat?.title ?? 'Group'}
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
          Scan to join this group
        </Text>

        <View style={{ marginTop: spacing.lg, padding: spacing.lg, backgroundColor: '#fff', borderRadius: 16 }}>
          {value ? <QRCode value={value} size={220} /> : <Text style={{ color: colors.textMuted }}>No invite code</Text>}
        </View>

        {chat?.inviteExpiresAt ? (
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>
            Expires: {chat.inviteExpiresAt.toLocaleString()}
          </Text>
        ) : (
          <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>
            No expiry
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

export default GroupInviteScreen;
