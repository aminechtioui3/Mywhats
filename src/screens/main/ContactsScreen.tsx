// src/screens/main/ContactsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  FlatList,
  RefreshControl,
  Keyboard,
  Platform,
  InputAccessoryView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../api/firebase';
import { useAuth } from '../../context/AuthContext';
import { Contact } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';
import FloatingActionButton from '../../components/FloatingActionButton';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import { useNavigation } from '@react-navigation/native';
import ConfirmModal from '../../components/ConfirmModal';

type FilterMode = 'all' | 'favorites';

const ACCESSORY_ID = 'AddContactAccessory';

// Keep only leading + and digits
const normalizePhone = (raw: string) => {
  const trimmed = (raw || '').trim();
  const only = trimmed.replace(/[^\d+]/g, '');
  return only.replace(/(?!^)\+/g, '');
};

const ContactsScreen: React.FC = () => {
  const { profile } = useAuth();
  const navigation: any = useNavigation();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKbVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKbVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ------- Load contacts -------
  const loadContacts = useCallback(async () => {
    if (!profile) return;
    const col = collection(db, 'users', profile.id, 'contacts');
    const snap = await getDocs(col);
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
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    loadContacts();
  }, [profile?.id, loadContacts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  };

  // ------- Derived list (filter + search) -------
  const filtered = useMemo(() => {
    const base =
      filter === 'favorites' ? contacts.filter((c) => c.isFavorite) : contacts;
    if (!search.trim()) return base;
    const s = search.toLowerCase();
    return base.filter(
      (c) =>
        (c.displayName || '').toLowerCase().includes(s) ||
        (c.phone || '').toLowerCase().includes(s)
    );
  }, [contacts, filter, search]);

  // ------- Add contact -------
  const handleAddContact = async () => {
    if (!profile) {
      Alert.alert('Please wait', 'Profile is still loading. Try again in a moment.');
      return;
    }
    const raw = newPhone.trim();
    if (!raw) {
      Alert.alert('Missing phone', 'Enter a phone number.');
      return;
    }

    setLoading(true);
    try {
      const phoneNormalized = normalizePhone(raw);

      // prevent adding self (compare normalized)
      if (normalizePhone(profile.phone) === phoneNormalized) {
        Alert.alert('Oops', 'You cannot add yourself.');
        setLoading(false);
        return;
      }

      // already in contacts? (compare normalized)
      const exists = contacts.some((c) => normalizePhone(c.phone) === phoneNormalized);
      if (exists) {
        Alert.alert('Already added', 'This phone is already in your contacts.');
        setLoading(false);
        return;
      }

      // Find user by normalized phone
      const usersQ = query(collection(db, 'users'), where('phoneNormalized', '==', phoneNormalized));
      const snap = await getDocs(usersQ);
      if (snap.empty) {
        Alert.alert(
          'Not found',
          'No user found with this phone number. Make sure they signed up using the same number.'
        );
        setLoading(false);
        return;
      }

      const userDoc = snap.docs[0];
      const userData = userDoc.data() as any;
      const displayName = newName.trim() || userData.displayName || raw;

      // Create your contact
      const contactRef = doc(db, 'users', profile.id, 'contacts', userDoc.id);
      await setDoc(contactRef, {
        contactUserId: userDoc.id,
        displayName,
        phone: userData.phone ?? raw,               // keep original readable phone
        phoneNormalized,                             // store normalized too
        avatarUrl: userData.avatarUrl ?? '',
        isFavorite: false,
        createdAt: serverTimestamp(),
      });

      setNewPhone('');
      setNewName('');
      setAddModalVisible(false);
      Keyboard.dismiss();

      const c: Contact = {
        id: userDoc.id,
        contactUserId: userDoc.id,
        displayName,
        phone: userData.phone ?? raw,
        avatarUrl: userData.avatarUrl ?? '',
        isFavorite: false,
        createdAt: new Date(),
      };
      setContacts((prev) => [c, ...prev]);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not add contact');
    } finally {
      setLoading(false);
    }
  };

  // ------- Delete contact (pretty confirm) -------
  const confirmDelete = (c: Contact) => setContactToDelete(c);

  const handleDeleteContact = async () => {
    if (!profile || !contactToDelete) return;
    setDeleting(true);
    try {
      const contactRef = doc(db, 'users', profile.id, 'contacts', contactToDelete.id);
      await deleteDoc(contactRef);

      setContacts((prev) => prev.filter((c) => c.id !== contactToDelete.id));
      setSelectedContact((prev) =>
        prev && prev.id === contactToDelete.id ? null : prev
      );
    } catch (e) {
      console.warn('Error deleting contact', e);
    } finally {
      setDeleting(false);
      setContactToDelete(null);
    }
  };

  // ------- Toggle favorite -------
  const toggleFavorite = async (c: Contact) => {
    if (!profile) return;
    const ref = doc(db, 'users', profile.id, 'contacts', c.id);
    const next = !c.isFavorite;
    await updateDoc(ref, { isFavorite: next });
    setContacts((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, isFavorite: next } : x))
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Header */}
      <HeaderBar
        title="Contacts"
        subtitle={`${contacts.length} saved`}
        rightAction={{
          label: 'Add',
          icon: 'add',
          onPress: () => setAddModalVisible(true),
        }}
      />

      {/* Controls */}
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as FilterMode)}
          options={[
            { key: 'all', label: 'All', icon: 'people-outline' },
            { key: 'favorites', label: 'Favorites', icon: 'star-outline' },
          ]}
        />

        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by name or phone…"
          inputAccessoryViewID={ACCESSORY_ID}
        />
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: spacing.xl * 3, paddingTop: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              navigation.navigate('Chat', {
                chatId: null,
                contactUserId: item.contactUserId,
              })
            }
            onLongPress={() => confirmDelete(item)}
            android_ripple={{ color: '#00000010' }}
            style={{
              marginHorizontal: spacing.lg,
              marginBottom: spacing.sm,
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.xl,
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <ContactRow
              contact={item}
              onOpen={() =>
                navigation.navigate('Chat', {
                  chatId: null,
                  contactUserId: item.contactUserId,
                })
              }
              onAvatar={() => setSelectedContact(item)}
              onFavorite={() => toggleFavorite(item)}
              onDelete={() => confirmDelete(item)}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No contacts yet"
            subtitle="Add people by phone number to start messaging."
            icon="person-add-outline"
            actionLabel="Add contact"
            onAction={() => setAddModalVisible(true)}
          />
        }
      />

      {/* Quick add FAB */}
      <FloatingActionButton
        icon={<Ionicons name="person-add-outline" size={28} color={colors.textPrimary} />}
        onPress={() => setAddModalVisible(true)}
      />

      {/* Avatar quick popup */}
      <Modal visible={!!selectedContact} transparent animationType="fade">
        <Pressable
          style={{
            flex: 1,
            backgroundColor: '#00000088',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onPress={() => setSelectedContact(null)}
        >
          {selectedContact && (
            <View
              style={{
                width: '86%',
                backgroundColor: colors.backgroundElevated,
                borderRadius: radius.xl,
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
                <Avatar
                  name={selectedContact.displayName}
                  uri={selectedContact.avatarUrl}
                  size={72}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: '700',
                    marginTop: spacing.sm,
                  }}
                >
                  {selectedContact.displayName}
                </Text>
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                  {selectedContact.phone}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginTop: spacing.md,
                }}
              >
                <IconPill
                  icon="chatbubble-ellipses-outline"
                  label="Message"
                  onPress={() => {
                    setSelectedContact(null);
                    navigation.navigate('Chat', {
                      chatId: null,
                      contactUserId: selectedContact.contactUserId,
                    });
                  }}
                />
                <IconPill
                  icon={selectedContact.isFavorite ? 'star' : 'star-outline'}
                  label={selectedContact.isFavorite ? 'Favorited' : 'Favorite'}
                  onPress={() => toggleFavorite(selectedContact)}
                />
                <IconPill
                  icon="information-circle-outline"
                  label="Details"
                  onPress={() => {
                    setSelectedContact(null);
                    navigation.navigate('ContactDetails', {
                      contactUserId: selectedContact.contactUserId,
                    });
                  }}
                />
                <IconPill
                  icon="trash-outline"
                  label="Delete"
                  danger
                  onPress={() => {
                    setSelectedContact(null);
                    confirmDelete(selectedContact);
                  }}
                />
              </View>
            </View>
          )}
        </Pressable>
      </Modal>

      {/* Add contact full-screen modal with iOS-friendly keyboard handling */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setAddModalVisible(false);
          Keyboard.dismiss();
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: colors.background,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  padding: spacing.lg,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 16,
                      fontWeight: '800',
                      flex: 1,
                    }}
                  >
                    Add contact
                  </Text>
                  <Pressable
                    onPress={() => {
                      setAddModalVisible(false);
                      Keyboard.dismiss();
                    }}
                    hitSlop={8}
                    android_ripple={{ color: '#00000010', borderless: true }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.backgroundElevated,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>

                <LabeledField label="Phone number">
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
                      name="call-outline"
                      size={18}
                      color={colors.textMuted}
                      style={{ marginRight: spacing.sm }}
                    />
                    <TextInput
                      placeholder="e.g. +216 99 000 000"
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.textMuted}
                      style={{ flex: 1, paddingVertical: spacing.sm, color: colors.textPrimary }}
                      value={newPhone}
                      onChangeText={setNewPhone}
                      autoCorrect={false}
                      autoCapitalize="none"
                      autoFocus
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      textContentType="telephoneNumber"
                      {...(Platform.OS === 'ios' ? { inputAccessoryViewID: ACCESSORY_ID } : {})}
                    />
                  </View>
                </LabeledField>

                <LabeledField label="Contact name (optional)">
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
                      name="person-outline"
                      size={18}
                      color={colors.textMuted}
                      style={{ marginRight: spacing.sm }}
                    />
                    <TextInput
                      placeholder="Custom name"
                      placeholderTextColor={colors.textMuted}
                      style={{ flex: 1, paddingVertical: spacing.sm, color: colors.textPrimary }}
                      value={newName}
                      onChangeText={setNewName}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      autoCorrect={false}
                      autoCapitalize="words"
                      {...(Platform.OS === 'ios' ? { inputAccessoryViewID: ACCESSORY_ID } : {})}
                    />
                  </View>
                </LabeledField>

                <View
                  style={{
                    flexDirection: 'row',
                    gap: spacing.sm,
                    marginTop: spacing.lg,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setAddModalVisible(false);
                      Keyboard.dismiss();
                    }}
                    style={{
                      flex: 1,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: 'center',
                      paddingVertical: spacing.md,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleAddContact}
                    disabled={loading}
                    style={{
                      flex: 1,
                      borderRadius: radius.lg,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      paddingVertical: spacing.md,
                      opacity: loading ? 0.7 : 1,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>
                      {loading ? 'Adding…' : 'Add contact'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>

          {/* iOS-only accessory within the modal, so it works with phone-pad */}
          {Platform.OS === 'ios' ? (
            <InputAccessoryView nativeID={ACCESSORY_ID}>
              <View
                style={{
                  backgroundColor: colors.backgroundElevated,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  paddingVertical: 6,
                  paddingHorizontal: spacing.md,
                  alignItems: 'flex-end',
                }}
              >
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.primary,
                  }}
                >
                  <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Hide</Text>
                </Pressable>
              </View>
            </InputAccessoryView>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      {/* Pretty delete confirmation */}
      <ConfirmModal
        visible={!!contactToDelete}
        title="Delete contact?"
        message={
          deleting
            ? 'Deleting contact...'
            : 'This removes the contact from your list. Chat history stays until you delete the conversation.'
        }
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        danger
        onCancel={() => (deleting ? null : setContactToDelete(null))}
        onConfirm={deleting ? () => {} : handleDeleteContact}
      />

      {/* Global iOS keyboard accessory for non-modal text inputs */}
      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={ACCESSORY_ID}>
          <View
            style={{
              backgroundColor: colors.backgroundElevated,
              borderTopWidth: 1,
              borderColor: colors.border,
              paddingVertical: 6,
              paddingHorizontal: spacing.md,
              alignItems: 'flex-end',
            }}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: spacing.md,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: colors.primary,
              }}
            >
              <Ionicons name="chevron-down" size={16} color={colors.textPrimary} />
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Hide</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {/* Android floating hide button when keyboard is visible */}
      {Platform.OS === 'android' && kbVisible ? (
        <Pressable
          onPress={() => Keyboard.dismiss()}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.backgroundElevated,
            borderWidth: 1,
            borderColor: colors.border,
            elevation: 3,
          }}
        >
          <Ionicons name="chevron-down" size={22} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
};

export default ContactsScreen;

/* ------------------------------ */
/* Polished local UI subcomponents */
/* ------------------------------ */

function HeaderBar({
  title,
  subtitle,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; icon?: any; onPress: () => void };
}) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: typography.h2,
            fontWeight: '800',
            flex: 1,
          }}
        >
          {title}
        </Text>

        {rightAction ? (
          <Pressable
            onPress={rightAction.onPress}
            android_ripple={{ color: '#00000010', borderless: true }}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: '#E2E8FF',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {rightAction.icon ? (
              <Ionicons name={rightAction.icon} size={16} color={colors.textPrimary} />
            ) : null}
            <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>
              {rightAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {subtitle ? <Text style={{ color: colors.textSecondary }}>{subtitle}</Text> : null}
    </View>
  );
}

function SegmentedControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (next: string) => void;
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

function SearchField({
  value,
  onChange,
  placeholder,
  inputAccessoryViewID,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  inputAccessoryViewID?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: radius.xl,
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
        placeholder={placeholder || 'Search…'}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={Keyboard.dismiss}
        autoCorrect={false}
        autoCapitalize="none"
        {...(Platform.OS === 'ios' && inputAccessoryViewID
          ? { inputAccessoryViewID }
          : {})}
        style={{
          flex: 1,
          paddingVertical: spacing.sm,
          color: colors.textPrimary,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={8}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#F1F5FF',
            borderWidth: 1,
            borderColor: '#E2E8FF',
          }}
        >
          <Ionicons name="close" size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function EmptyState({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        marginTop: spacing.xl * 1.2,
        paddingHorizontal: spacing.lg,
        gap: spacing.sm,
      }}
    >
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
            marginBottom: spacing.sm,
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
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
          {subtitle}
        </Text>
      ) : null}
      {onAction && actionLabel ? (
        <Pressable
          onPress={onAction}
          style={{
            marginTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            backgroundColor: colors.primary,
            borderRadius: 999,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
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
    <View style={{ marginBottom: spacing.md }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function IconPill({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: any;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.border,
        backgroundColor: danger ? '#FFF1F2' : colors.background,
        marginHorizontal: 4,
      }}
    >
      <Ionicons
        name={icon}
        size={18}
        color={danger ? colors.danger : colors.textSecondary}
      />
      <Text
        style={{
          marginTop: 4,
          color: danger ? colors.danger : colors.textSecondary,
          fontWeight: '600',
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ContactRow({
  contact,
  onOpen,
  onAvatar,
  onFavorite,
  onDelete,
}: {
  contact: Contact;
  onOpen: () => void;
  onAvatar: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
      <Pressable onPress={onAvatar}>
        <Avatar name={contact.displayName} uri={contact.avatarUrl} size={44} />
      </Pressable>

      <View style={{ marginLeft: spacing.md, flex: 1 }}>
        <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
          {contact.displayName}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{contact.phone}</Text>
      </View>

      <Pressable onPress={onFavorite} hitSlop={8} style={{ paddingHorizontal: 6 }}>
        <Ionicons
          name={contact.isFavorite ? 'star' : 'star-outline'}
          size={20}
          color={contact.isFavorite ? '#F59E0B' : colors.textSecondary}
        />
      </Pressable>

      <Pressable onPress={onOpen} hitSlop={8} style={{ paddingHorizontal: 6 }}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
      </Pressable>

      <Pressable onPress={onDelete} hitSlop={8} style={{ paddingHorizontal: 6 }}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
      </Pressable>
    </View>
  );
}
