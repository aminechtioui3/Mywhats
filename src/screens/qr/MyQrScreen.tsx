// src/screens/qr/MyQrScreen.tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { buildContactPayload } from '../../utils/qr';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';

const MyQrScreen: React.FC = () => {
  const { profile } = useAuth();
  const payload = profile?.id ? buildContactPayload(profile.id) : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={() => history.back()}
          style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: '#F8FAFF' }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ color: colors.textPrimary, fontSize: typography.h2, fontWeight: '800' }}>My QR</Text>
      </View>

      <View style={{ margin: spacing.lg, backgroundColor: colors.backgroundElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center' }}>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
          Ask others to scan this QR to add you as a contact.
        </Text>

        <View style={{ marginTop: spacing.lg, padding: spacing.lg, backgroundColor: '#fff', borderRadius: 16 }}>
          {payload ? <QRCode value={payload} size={240} /> : <Text style={{ color: colors.textMuted }}>No profile id</Text>}
        </View>

        <Text style={{ color: colors.textPrimary, marginTop: spacing.lg, fontWeight: '800' }}>
          {profile?.displayName || profile?.phone || 'Me'}
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default MyQrScreen;
