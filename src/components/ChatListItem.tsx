// src/components/ChatListItem.tsx
import React, { useRef } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Avatar from './Avatar';
import { colors, radius, spacing, typography } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  avatarUri?: string;
  isGroup?: boolean;
  lastMessageTime?: string;
  onPress: () => void;
  onAvatarPress?: () => void;
  onLongPress?: () => void;
  onSwipeDelete?: () => void;
};

const ChatListItem: React.FC<Props> = ({
  title,
  subtitle,
  avatarUri,
  isGroup,
  lastMessageTime,
  onPress,
  onAvatarPress,
  onLongPress,
  onSwipeDelete,
}) => {
  const swipeRef = useRef<Swipeable>(null);

  const renderRightActions = () => {
    if (!onSwipeDelete) return null;
    return (
      <Pressable
        onPress={() => {
          swipeRef.current?.close();
          onSwipeDelete?.();
        }}
        style={{
          width: 84,
          backgroundColor: colors.danger,
          alignItems: 'center',
          justifyContent: 'center',
          borderTopLeftRadius: radius.lg,
          borderBottomLeftRadius: radius.lg,
          marginVertical: spacing.sm,
        }}
        android_ripple={{ color: '#00000022' }}
      >
        <Ionicons name="trash-outline" size={24} color={colors.textPrimary} />
      </Pressable>
    );
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
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
          <Avatar name={title} uri={avatarUri} size={48} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontSize: typography.h3,
                fontWeight: '600',
                flex: 1,
              }}
            >
              {title}
            </Text>
            {lastMessageTime ? (
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  marginLeft: spacing.sm,
                }}
              >
                {lastMessageTime}
              </Text>
            ) : null}
          </View>

          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{ color: colors.textSecondary, marginTop: 2 }}
            >
              {subtitle}
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ color: colors.textMuted, marginTop: 2 }}>
              No messages yet
            </Text>
          )}
        </View>

        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textMuted}
          style={{ marginLeft: spacing.sm }}
        />
      </Pressable>
    </Swipeable>
  );
};

export default ChatListItem;
