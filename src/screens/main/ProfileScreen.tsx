// src/screens/main/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  Keyboard,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';

import { useAuth } from '../../context/AuthContext';
import { colors, radius, spacing, typography } from '../../theme';
import Avatar from '../../components/Avatar';
import ConfirmModal from '../../components/ConfirmModal';
import DismissKeyboardView from '../../components/DismissKeyboardView';

import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';

import { supabase } from '../../api/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

import { pickFromLibrary } from '../../utils/ImagePicker';
import { Ionicons } from '@expo/vector-icons';

const ProfileScreen: React.FC = () => {
  const navigation: any = useNavigation();
  const { profile, signOut, deleteAccount, loading } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [statusMessage, setStatusMessage] = useState('Hey there! I am using Chtiouis.');
  const [saving, setSaving] = useState(false);

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
      setPhone(profile.phone ?? '');
      setStatusMessage(profile.statusMessage ?? 'Hey there! I am using Chtiouis.');
      setAvatarLocalUri(null);
    }
  }, [profile]);

  const hardRedirectToLogin = () => {
    try {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    } catch {}
    const parent = navigation.getParent?.();
    if (parent) {
      try {
        parent.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AuthStack', params: { screen: 'Login' } }],
          })
        );
      } catch {}
    }
    try {
      navigation.navigate('Login');
    } catch {}
  };

  if (loading) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            textAlign: 'center',
            marginHorizontal: spacing.lg,
            fontSize: 16,
          }}
        >
          No profile data found. Try signing out and logging in again.
        </Text>
      </SafeAreaView>
    );
  }

  const handlePickAvatar = async () => {
    try {
      const picked = await pickFromLibrary();
      if (picked && picked.uri) {
        setAvatarLocalUri(picked.uri);
      }
    } catch (e) {
      console.warn('Error picking avatar image', e);
      Alert.alert('Error', 'Could not open image library. Please try again.');
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (saving) return;
    setSaving(true);

    try {
      const ref = doc(collection(db, 'users'), profile.id);

      let avatarUrl: string = (profile as any).avatarUrl || '';

      if (avatarLocalUri) {
        const base64 = await FileSystem.readAsStringAsync(avatarLocalUri, { encoding: 'base64' });
        const fileData = decode(base64);
        const ext = 'jpg';
        const filePath = `ProfilePictures/${profile.id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('ProfilePictures')
          .upload(filePath, fileData, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Supabase upload error', uploadError);
          throw uploadError;
        }

        const { data } = supabase.storage.from('ProfilePictures').getPublicUrl(filePath);
        avatarUrl = data?.publicUrl || avatarUrl;
      }

      const payload: any = {
        displayName: (displayName || '').trim(),
        phone: (phone || '').trim(),
        statusMessage: statusMessage ?? '',
      };
      if (avatarUrl) payload.avatarUrl = avatarUrl;

      await setDoc(ref, payload, { merge: true });

      Keyboard.dismiss();
      setAvatarLocalUri(null);
    } catch (e: any) {
      console.error('Error saving profile', e);
      Alert.alert('Error', e?.message ?? 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('Sign out error (ignored):', e);
    } finally {
      setTimeout(hardRedirectToLogin, 10);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      hardRedirectToLogin();
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Could not delete your account. Try again.');
    } finally {
      setDeletingAccount(false);
      setConfirmDeleteVisible(false);
    }
  };

  const emailReadOnly =
    (profile as any).email ??
    `${(profile.displayName || 'user').toString().replace(/\s+/g, '').toLowerCase()}@gmail.com`;

  const avatarUriToShow = avatarLocalUri || (profile as any).avatarUrl || undefined;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <DismissKeyboardView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
            }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: typography.h2,
                fontWeight: '700',
                marginBottom: spacing.lg,
              }}
            >
              Profile
            </Text>

            {/* Quick actions: My QR / Scan QR */}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
              <Pressable
                onPress={() => navigation.navigate('MyQr')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                }}
              >
                <Ionicons name="qr-code-outline" size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>My QR</Text>
              </Pressable>

              <Pressable
                onPress={() => navigation.navigate('QrScan')}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundElevated,
                  borderRadius: radius.lg,
                  paddingVertical: spacing.md,
                }}
              >
                <Ionicons name="scan-outline" size={18} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Scan QR</Text>
              </Pressable>
            </View>

            {/* Avatar + basic info */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
              <Pressable onPress={handlePickAvatar} hitSlop={8} style={{ alignItems: 'center' }}>
                <Avatar name={profile.displayName} uri={avatarUriToShow} size={80} />
                <Text
                  style={{
                    marginTop: spacing.sm,
                    color: colors.primary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  Change photo
                </Text>
              </Pressable>

              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: '600',
                  marginTop: spacing.sm,
                }}
              >
                {profile.displayName}
              </Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>{profile.phone}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>{emailReadOnly}</Text>
            </View>

            {/* Card with editable fields */}
            <View
              style={{
                backgroundColor: colors.backgroundElevated,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              {/* Display name */}
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Display name</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.textPrimary,
                  marginBottom: spacing.md,
                }}
              />

              {/* Phone */}
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Phone</Text>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="+216 20 000 000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                    style={{
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      color: colors.textPrimary,
                      marginBottom: spacing.md,
                    }}
                  />
                </View>
              </TouchableWithoutFeedback>

              {/* Email read-only */}
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Email (read-only)</Text>
              <View
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: colors.background,
                  marginBottom: spacing.md,
                }}
              >
                <Text style={{ color: colors.textSecondary }}>{emailReadOnly}</Text>
              </View>

              {/* Status */}
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>Status</Text>
              <TextInput
                value={statusMessage}
                onChangeText={setStatusMessage}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textMuted}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
                style={{
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.textPrimary,
                  minHeight: 80,
                  textAlignVertical: 'top',
                }}
              />

              <Pressable
                onPress={handleSave}
                style={{
                  marginTop: spacing.lg,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: 'center',
                  opacity: saving ? 0.7 : 1,
                }}
                disabled={saving}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>

            {/* Delete account */}
            <Pressable
              onPress={() => setConfirmDeleteVisible(true)}
              style={{
                marginTop: spacing.lg,
                backgroundColor: colors.danger,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Delete account</Text>
            </Pressable>

            {/* Sign out */}
            <Pressable
              onPress={handleSignOut}
              style={{
                marginTop: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.danger,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.danger, fontWeight: '600' }}>Sign out</Text>
            </Pressable>
          </ScrollView>
        </DismissKeyboardView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmDeleteVisible}
        title="Delete your account?"
        message={
          deletingAccount
            ? 'Deleting account...'
            : 'This will permanently remove your account. This action cannot be undone.'
        }
        confirmText={deletingAccount ? 'Deleting...' : 'Delete'}
        danger
        onCancel={() => (deletingAccount ? null : setConfirmDeleteVisible(false))}
        onConfirm={deletingAccount ? () => {} : handleConfirmDelete}
      />
    </SafeAreaView>
  );
};

export default ProfileScreen;
