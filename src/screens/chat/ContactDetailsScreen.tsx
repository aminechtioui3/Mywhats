// src/screens/main/ContactDetailsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { colors, radius, spacing, typography, elevations } from '../../theme';
import Avatar from '../../components/Avatar';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import ConfirmModal from '../../components/ConfirmModal';

interface Params {
  contactUserId: string;
}

interface ContactDetails {
  id: string;
  displayName: string;
  phone: string;
  avatarUrl?: string;
  lastSeen?: Date | null;
  statusMessage?: string;
}

const ContactDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<any>>();
  const { contactUserId } = route.params as Params;
  const navigation: any = useNavigation();
  const { profile } = useAuth();

  const [contact, setContact] = useState<ContactDetails | null>(null);
  const [editName, setEditName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [loading, setLoading] = useState(true);

  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingContact, setDeletingContact] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!profile) return;
      try {
        const userSnap = await getDoc(doc(db, 'users', contactUserId));
        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }
        const u = userSnap.data() as any;

        // Your personal label of this contact (saved name)
        const contactRef = doc(collection(db, 'users'), profile.id, 'contacts', contactUserId);
        const personalSnap = await getDoc(contactRef);

        let savedName: string | undefined;
        if (personalSnap.exists()) {
          const c = personalSnap.data() as any;
          savedName = c.displayName;
        }

        const displayName = savedName ?? u.displayName ?? u.phone;

        const c: ContactDetails = {
          id: userSnap.id,
          displayName,
          phone: u.phone,
          avatarUrl: u.avatarUrl,
          lastSeen: u.lastSeen?.toDate ? u.lastSeen.toDate() : null,
          statusMessage: u.statusMessage,
        };

        setContact(c);
        setEditName(displayName);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [contactUserId, profile?.id]);

  const handleSaveName = async () => {
    if (!profile || !contact) return;
    const name = editName.trim() || contact.phone;
    setSavingName(true);
    try {
      const ref = doc(db, 'users', profile.id, 'contacts', contactUserId);
      await setDoc(
        ref,
        {
          contactUserId,
          displayName: name,
          phone: contact.phone,
          avatarUrl: contact.avatarUrl ?? '',
        },
        { merge: true }
      );
      setContact((prev) => (prev ? { ...prev, displayName: name } : prev));
    } finally {
      setSavingName(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!profile) return;
    setDeletingContact(true);
    try {
      const ref = doc(db, 'users', profile.id, 'contacts', contactUserId);
      await deleteDoc(ref);
      navigation.goBack();
    } catch (e) {
      console.warn('Error deleting contact', e);
    } finally {
      setDeletingContact(false);
      setConfirmDeleteVisible(false);
    }
  };

  const lastSeenText =
    contact?.lastSeen
      ? `Last seen ${contact.lastSeen.toLocaleString()}`
      : 'Last seen recently';

  // Lite placeholders
  if (loading) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        {/* Minimal loading state in light theme */}
        <View style={{ padding: spacing.lg }}>
          <View
            style={{
              height: 44,
              width: 160,
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.md,
            }}
          />
          <View
            style={{
              marginTop: spacing.xl,
              height: 140,
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.xl,
            }}
          />
          <View
            style={{
              marginTop: spacing.lg,
              height: 64,
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.lg,
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!contact) {
    return (
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
        <View style={{ padding: spacing.lg }}>
          <HeaderBar title="Contact info" onBack={() => navigation.goBack()} />
          <Text
            style={{
              color: colors.textPrimary,
              textAlign: 'center',
              marginTop: spacing.xl,
            }}
          >
            Contact not found.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Elevated, pill-button header */}
      <HeaderBar title="Contact info" onBack={() => navigation.goBack()} />

      {/* HERO CARD */}
      <View
        style={{
          marginHorizontal: spacing.lg,
          marginTop: spacing.lg,
          backgroundColor: colors.backgroundElevated,
          borderRadius: radius.xl,
          padding: spacing.lg,
          elevation: elevations.card,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          alignItems: 'center',
        }}
      >
        <Avatar name={contact.displayName} uri={contact.avatarUrl} size={96} />

        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            fontSize: 20,
            fontWeight: '700',
            marginTop: spacing.sm,
          }}
        >
          {contact.displayName}
        </Text>

        <Text
          numberOfLines={1}
          style={{ color: colors.textSecondary, marginTop: 2 }}
        >
          {lastSeenText}
        </Text>

        {/* Quick actions */}
        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            marginTop: spacing.lg,
          }}
        >
          <IconPill
            label="Message"
            icon="chatbubble-ellipses-outline"
            onPress={() =>
              navigation.navigate('Chat', { chatId: null, contactUserId })
            }
          />
          <IconPill
            label="Call"
            icon="call-outline"
            onPress={() => {
              // reserved for later in-app call flow
              // (kept as UI only, per your decision)
            }}
          />
        </View>
      </View>

      {/* SAVED NAME (editable) */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <SectionLabel text="Saved name" />
        <View
          style={{
            backgroundColor: colors.backgroundElevated,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons
            name="pricetag-outline"
            size={18}
            color={colors.textMuted}
            style={{ marginHorizontal: spacing.sm }}
          />
          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder="Contact name"
            placeholderTextColor={colors.textMuted}
            style={{
              flex: 1,
              color: colors.textPrimary,
              paddingVertical: spacing.sm,
              fontSize: 16,
            }}
          />
          <Pressable
            onPress={handleSaveName}
            android_ripple={{ color: '#00000010', borderless: true }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              backgroundColor: colors.primary,
              opacity: savingName ? 0.7 : 1,
            }}
            disabled={savingName}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {savingName ? 'Saving…' : 'Save'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* INFO CARDS */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <InfoCard
          label="Phone"
          value={contact.phone}
          icon="call-outline"
        />
        <InfoCard
          label="Status"
          value={contact.statusMessage ?? 'Hey there! I am using BourouisWhatsApp.'}
          icon="information-circle-outline"
          style={{ marginTop: spacing.lg }}
        />
      </View>

      {/* DANGER ZONE */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.xl }}>
        <Pressable
          onPress={() => setConfirmDeleteVisible(true)}
          android_ripple={{ color: '#00000010', borderless: false }}
          style={{
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.danger,
            paddingVertical: spacing.md,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing.sm,
            backgroundColor: '#FFF5F5',
          }}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={{ color: colors.danger, fontWeight: '700' }}>
            Delete contact
          </Text>
        </Pressable>
      </View>

      {/* Confirm delete modal */}
      <ConfirmModal
        visible={confirmDeleteVisible}
        title="Delete contact?"
        message={
          deletingContact
            ? 'Deleting contact...'
            : 'This removes the contact from your list. Conversation history is kept until you delete it from Chats.'
        }
        confirmText={deletingContact ? 'Deleting…' : 'Delete'}
        danger
        onCancel={() => (deletingContact ? null : setConfirmDeleteVisible(false))}
        onConfirm={deletingContact ? () => {} : handleDeleteContact}
      />
    </SafeAreaView>
  );
};

export default ContactDetailsScreen;

/* ----------------------- */
/* Reusable UI subcomponents */
/* ----------------------- */

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
          elevation: elevations.bar,
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

function SectionLabel({ text }: { text: string }) {
  return (
    <Text
      style={{
        color: colors.textSecondary,
        fontSize: 12,
        marginBottom: spacing.sm,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}
    >
      {text}
    </Text>
  );
}

function IconPill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#00000010', borderless: true }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.border,
        elevation: elevations.card,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Ionicons name={icon} size={16} color={colors.textPrimary} />
      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function InfoCard({
  label,
  value,
  icon,
  style,
}: {
  label: string;
  value: string;
  icon: any;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.backgroundElevated,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: elevations.card,
          shadowColor: '#000',
          shadowOpacity: 0.03,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            marginLeft: spacing.sm,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          }}
        >
          {label}
        </Text>
      </View>
      <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{value}</Text>
    </View>
  );
}
