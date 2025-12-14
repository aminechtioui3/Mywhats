import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme';
import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';

interface Params {
  code: string; // invite code from link
}

const JoinChatScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const navigation: any = useNavigation();
  const { code } = route.params as Params;
  const { profile } = useAuth();

  const [chatId, setChatId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Group');

  useEffect(() => {
    (async () => {
      // find chat by inviteCode
      const q = query(collection(db, 'chats'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) {
        Alert.alert('Invalid link', 'This invite link is not valid anymore.');
        navigation.goBack();
        return;
      }
      const d = snap.docs[0];
      setChatId(d.id);
      const c: any = d.data();
      setTitle(c.title || 'Group');

      // if expired
      if (c.inviteExpiresAt && c.inviteExpiresAt.toDate) {
        const exp: Date = c.inviteExpiresAt.toDate();
        if (exp.getTime() < Date.now()) {
          Alert.alert('Expired', 'This invite link has expired.');
          navigation.goBack();
          return;
        }
      }
    })();
  }, [code]);

  const join = async () => {
    if (!profile || !chatId) return;

    const snap = await getDocs(query(collection(db, 'chats'), where('__name__', '==', chatId)));
    if (snap.empty) return;
    const docSnap = snap.docs[0];
    const c: any = docSnap.data();

    if ((c.memberIds ?? []).includes(profile.id)) {
      navigation.replace('Chat', { chatId, contactUserId: null });
      return;
    }

    if (c.joinApprovalRequired) {
      await addDoc(collection(db, 'chats', chatId, 'joinRequests'), {
        requesterId: profile.id,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Request sent', 'Your join request has been sent to the admins.');
      navigation.goBack();
      return;
    }

    // Directly join
    const updated = [...(c.memberIds ?? []), profile.id];
    await updateDoc(doc(db, 'chats', chatId), {
      memberIds: updated,
      updatedAt: serverTimestamp(),
    });
    navigation.replace('Chat', { chatId, contactUserId: null });
  };

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
        <Text style={{ color: colors.textPrimary, fontSize: typography.h2, fontWeight: '800' }}>Join group</Text>
      </View>

      <View style={{ margin: spacing.lg, backgroundColor: colors.backgroundElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>
          {title}
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: spacing.sm }}>
          Use this screen to join via invite link.
        </Text>

        <Pressable
          onPress={join}
          style={{
            marginTop: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.primary,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Join</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

import { Ionicons } from '@expo/vector-icons';
export default JoinChatScreen;
