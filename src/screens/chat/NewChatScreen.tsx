// src/screens/main/NewChatScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Contact } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';
import ContactListItem from '../../components/ContactListItem';
import Avatar from '../../components/Avatar';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'direct' | 'group';

const NewChatScreen: React.FC = () => {
  const { profile } = useAuth();
  const navigation: any = useNavigation();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [mode, setMode] = useState<Mode>('direct');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const snap = await getDocs(collection(db, 'users', profile.id, 'contacts'));
      const list: Contact[] = snap.docs.map((d) => {
        const c = d.data() as any;
        return {
          id: d.id,
          contactUserId: c.contactUserId,
          displayName: c.displayName,
          phone: c.phone,
          avatarUrl: c.avatarUrl,
          isFavorite: c.isFavorite ?? false,
          createdAt: c.createdAt?.toDate ? c.createdAt.toDate() : null,
        };
      });
      setContacts(list);
    };
    load();
  }, [profile?.id]);

  const filtered = useMemo(
    () =>
      contacts.filter((c) =>
        (c.displayName || '').toLowerCase().includes(search.toLowerCase())
      ),
    [contacts, search]
  );

  const toggleSelect = (id: string) => {
    if (mode === 'direct') {
      setSelectedIds([id]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    }
  };

  const handleCreate = async () => {
    if (!profile) return;

    if (mode === 'direct') {
      if (!selectedIds[0]) return;
      navigation.replace('Chat', { chatId: null, contactUserId: selectedIds[0] });
      return;
    }

    if (!groupName.trim() || selectedIds.length === 0) return;

    const memberIds = [profile.id, ...selectedIds];
    const chatRef = await addDoc(collection(db, 'chats'), {
      type: 'group',
      title: groupName.trim(),
      memberIds,
      adminId: profile.id,
      createdById: profile.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    navigation.replace('Chat', { chatId: chatRef.id });
  };

  const actionDisabled =
    (mode === 'direct' && selectedIds.length === 0) ||
    (mode === 'group' && (selectedIds.length === 0 || !groupName.trim()));

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header with QR shortcut */}
      <HeaderBar
        title="New conversation"
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={() => navigation.navigate('QrScan')} android_ripple={{ color: '#00000010', borderless: true }}>
            <Ionicons name="qr-code-outline" size={20} color={colors.textPrimary} />
          </Pressable>
        }
      />

      {/* Hero / Mode selector */}
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
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 18,
            fontWeight: '800',
            marginBottom: spacing.md,
          }}
        >
          Start a chat
        </Text>

        <SegmentedControl
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSelectedIds([]);
          }}
          options={[
            { key: 'direct', label: 'Direct', icon: 'person-outline' },
            { key: 'group', label: 'Group', icon: 'people-outline' },
          ]}
        />

        {mode === 'group' && (
          <View style={{ marginTop: spacing.md }}>
            <LabeledField label="Group name">
              <TextInput
                placeholder="e.g. MonClub Team"
                placeholderTextColor={colors.textMuted}
                value={groupName}
                onChangeText={setGroupName}
                style={{
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  color: colors.textPrimary,
                  backgroundColor: colors.background,
                }}
              />
            </LabeledField>
          </View>
        )}

        <LabeledField label="Search">
          <SearchField value={search} onChange={setSearch} />
        </LabeledField>

        {mode === 'group' && selectedIds.length > 0 && (
          <SelectedStrip
            contacts={contacts.filter((c) => selectedIds.includes(c.contactUserId))}
            onRemove={(id) =>
              setSelectedIds((prev) => prev.filter((x) => x !== id))
            }
          />
        )}
      </View>

      {/* Contacts list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.contactUserId}
        contentContainerStyle={{ paddingBottom: spacing.xl * 2 }}
        ListEmptyComponent={
          <EmptyState
            title="No contacts yet"
            subtitle="Add some contacts first to start a conversation."
            icon="person-add-outline"
          />
        }
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.contactUserId);
          return (
            <Pressable
              onPress={() => toggleSelect(item.contactUserId)}
              android_ripple={{ color: '#00000010' }}
              style={{
                marginHorizontal: spacing.lg,
                marginTop: spacing.sm,
                borderRadius: radius.lg,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? '#EEF2FF' : colors.backgroundElevated,
              }}
            >
              <View style={{ position: 'relative' }}>
                <ContactListItem
                  contact={item}
                  onPress={() => toggleSelect(item.contactUserId)}
                  onAvatarPress={() => toggleSelect(item.contactUserId)}
                />
                <View
                  style={{
                    position: 'absolute',
                    right: spacing.md,
                    top: '50%',
                    marginTop: -12,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderWidth: selected ? 0 : 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={selected ? 'checkmark' : 'add'}
                    size={14}
                    color={selected ? colors.textPrimary : colors.textSecondary}
                  />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Footer CTA */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <Pressable
          onPress={handleCreate}
          disabled={actionDisabled}
          style={{
            backgroundColor: actionDisabled ? '#E8ECF7' : colors.primary,
            borderRadius: radius.xl,
            alignItems: 'center',
            paddingVertical: spacing.md,
          }}
        >
          <Text
            style={{
              color: actionDisabled ? colors.textSecondary : colors.textPrimary,
              fontWeight: '800',
            }}
          >
            {mode === 'direct'
              ? 'Start chat'
              : `Create group (${selectedIds.length} selected)`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default NewChatScreen;

/* -------------------- */
/* UI subcomponents     */
/* -------------------- */

function HeaderBar({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
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
          flex: 1,
        }}
      >
        {title}
      </Text>

      {right ?? null}
    </View>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: any) => void;
  options: { key: string; label: string; icon?: any }[];
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#F6F8FD',
        borderRadius: 999,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E7ECF5',
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            android_ripple={{ color: '#00000010', borderless: true }}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : 'transparent',
            }}
          >
            {opt.icon ? (
              <Ionicons
                name={opt.icon}
                size={16}
                color={active ? colors.textPrimary : colors.textSecondary}
              />
            ) : null}
            <Text
              style={{
                color: active ? colors.textPrimary : colors.textSecondary,
                fontWeight: '800',
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LabeledField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          marginBottom: 6,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.background,
      }}
    >
      <Ionicons
        name="search-outline"
        size={18}
        color={colors.textMuted}
        style={{ marginRight: spacing.sm }}
      />
      <TextInput
        placeholder="Search contacts…"
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
        }}
      />
    </View>
  );
}

function SelectedStrip({
  contacts,
  onRemove,
}: {
  contacts: Contact[];
  onRemove: (id: string) => void;
}) {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          marginBottom: 6,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        Selected
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {contacts.map((c) => (
          <View
            key={c.contactUserId}
            style={{
              marginRight: spacing.sm,
              backgroundColor: colors.background,
              borderRadius: radius.lg,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Avatar name={c.displayName} uri={c.avatarUrl} size={24} />
            <Text style={{ color: colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>
              {c.displayName}
            </Text>
            <Pressable
              onPress={() => onRemove(c.contactUserId)}
              hitSlop={8}
              style={{
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 11,
                backgroundColor: '#FEE2E2',
              }}
            >
              <Ionicons name="close" size={14} color={colors.danger} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function EmptyState({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
}) {
  return (
    <View style={{ alignItems: 'center', marginTop: spacing.xl * 1.2 }}>
      {icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F1F5FF',
            borderWidth: 1,
            borderColor: '#E2E8FF',
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
      ) : null}
      <Text
        style={{
          color: colors.textPrimary,
          fontWeight: '800',
          fontSize: 16,
          marginBottom: 4,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingHorizontal: spacing.lg }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
