// src/screens/qr/QRScanScreen.tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors, radius, spacing, typography } from '../../theme';

type Parsed =
  | { kind: 'group'; code: string }
  | { kind: 'contact'; userId: string }
  | { kind: 'unknown'; raw: string };

function parseQRPayload(raw: string): Parsed {
  // 1) Try URL
  try {
    const url = new URL(raw);
    const proto = url.protocol.replace(':', '');
    const host = url.host;

    // Web invite: https://yourapp.example/join?c=CODE   (from your GroupInviteScreen)
    if ((proto === 'https' || proto === 'http') && url.pathname.includes('/join')) {
      const code = url.searchParams.get('c') || url.searchParams.get('code');
      if (code) return { kind: 'group', code };
    }

    // Deep links (optional): myapp://join?code=CODE  or  myapp://contact?u=USERID
    if (proto === 'myapp') {
      if (url.hostname === 'join') {
        const code = url.searchParams.get('code') || url.searchParams.get('c');
        if (code) return { kind: 'group', code };
      }
      if (url.hostname === 'contact') {
        const userId = url.searchParams.get('u') || url.searchParams.get('userId');
        if (userId) return { kind: 'contact', userId };
      }
    }
  } catch {}

  // 2) Try JSON payloads: {"t":"group","c":"CODE"} or {"t":"contact","u":"USERID"}
  try {
    const obj = JSON.parse(raw);
    if (obj?.t === 'group' && obj?.c) return { kind: 'group', code: String(obj.c) };
    if (obj?.t === 'contact' && obj?.u) return { kind: 'contact', userId: String(obj.u) };
  } catch {}

  return { kind: 'unknown', raw };
}

const QRScanScreen: React.FC = () => {
  const navigation: any = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();

  const [paused, setPaused] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [torch, setTorch] = useState(false);

  const handleResult = useCallback(
    (res: BarcodeScanningResult) => {
      if (paused) return;
      setPaused(true);

      const parsed = parseQRPayload(res.data);

      if (parsed.kind === 'group') {
        // Ask before joining
        Alert.alert(
          'Join group?',
          `Use invite code: ${parsed.code}`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
            {
              text: 'Join',
              style: 'default',
              onPress: () => navigation.replace('JoinChat', { code: parsed.code }),
            },
          ],
          { cancelable: false }
        );
        return;
      }

      if (parsed.kind === 'contact') {
        Alert.alert(
          'Add contact?',
          `User ID: ${parsed.userId}`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setPaused(false) },
            // Change the route below to your actual "confirm add contact" screen
            {
              text: 'Add',
              style: 'default',
              onPress: () => navigation.navigate('AddContactConfirm', { userId: parsed.userId }),
            },
          ],
          { cancelable: false }
        );
        return;
      }

      // Unknown payload → show it and resume
      Alert.alert(
        'QR not recognized',
        parsed.raw.slice(0, 200),
        [{ text: 'OK', onPress: () => setPaused(false) }],
        { cancelable: false }
      );
    },
    [paused, navigation]
  );

  if (!permission) {
    // still loading permission object
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textPrimary }}>Checking camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: spacing.lg }}>
          <Header title="Scan QR" onBack={() => navigation.goBack()} />
          <View
            style={{
              marginTop: spacing.lg,
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700' }}>
              Camera access needed
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
              We use your camera to scan group invite and contact QR codes.
            </Text>

            <Pressable
              onPress={requestPermission}
              style={{
                marginTop: spacing.lg,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: colors.primary,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Grant permission</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#000' }}>
      <Header transparent title="Scan QR" onBack={() => navigation.goBack()} />

      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing={facing}
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={paused ? undefined : handleResult}
        />

        {/* Overlay UI */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <Text
            style={{
              color: '#fff',
              textAlign: 'center',
              fontSize: 13,
              opacity: 0.85,
              marginBottom: spacing.sm,
            }}
          >
            Align the QR code within the frame
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.md }}>
            <CircleButton
              icon={torch ? 'flash' : 'flash-off'}
              label={torch ? 'Torch on' : 'Torch off'}
              onPress={() => setTorch((t) => !t)}
            />
            <CircleButton
              icon="camera-reverse"
              label="Flip"
              onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            />
            {paused ? (
              <CircleButton
                icon="scan"
                label="Scan again"
                onPress={() => setPaused(false)}
              />
            ) : null}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default QRScanScreen;

/* ---------------- UI bits ---------------- */

function Header({
  title,
  onBack,
  transparent,
}: {
  title: string;
  onBack: () => void;
  transparent?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: transparent ? 'transparent' : colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <Pressable
        onPress={onBack}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: transparent ? 0 : 1,
          borderColor: colors.border,
          backgroundColor: transparent ? '#00000055' : '#F8FAFF',
        }}
      >
        <Ionicons
          name="chevron-back"
          size={20}
          color={transparent ? '#fff' : colors.textPrimary}
        />
      </Pressable>

      <Text
        numberOfLines={1}
        style={{
          color: transparent ? '#fff' : colors.textPrimary,
          fontSize: typography.h2,
          fontWeight: '800',
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function CircleButton({
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
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#00000066',
        borderWidth: 1,
        borderColor: '#ffffff33',
      }}
    >
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 10, marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
}
