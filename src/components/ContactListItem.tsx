// src/components/ContactListItem.tsx
import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { Contact } from '../types';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  contact: Contact;
  onPress: () => void;
  onAvatarPress?: () => void;
};

const ContactListItem: React.FC<Props> = ({ contact, onPress, onAvatarPress }) => {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: '#ffffff11' }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginHorizontal: spacing.sm,
        marginVertical: spacing.xs,
        borderRadius: radius.lg,
        backgroundColor: colors.backgroundElevated,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable
        onPress={onAvatarPress}
        style={{ marginRight: spacing.md }}
        android_ripple={{ color: '#ffffff22', borderless: true }}
      >
        <Avatar name={contact.displayName} uri={contact.avatarUrl} size={48} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.textPrimary,
            fontSize: typography.h3,
            fontWeight: '600',
          }}
        >
          {contact.displayName}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.textSecondary, marginTop: 2 }}>
          {contact.phone}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
};

export default ContactListItem;
