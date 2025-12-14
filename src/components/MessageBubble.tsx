import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Message } from '../types';
import { colors, radius, spacing } from '../theme';

type ReplyPreview = {
  senderName: string;
  snippet?: string;
  thumbnailUrl?: string;
};

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showDetails?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;

  // NEW: quoted reply preview (resolved by parent)
  replyPreview?: ReplyPreview | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showDetails,
  onPress,
  onLongPress,
  replyPreview,
}) => {
  const timeLabel = message.createdAt
    ? message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const edited = !!message.editedAt;

  return (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xs }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '80%' }}
      >
        <View
          style={{
            backgroundColor: isOwn ? colors.primarySoft : colors.backgroundElevated,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          }}
        >
          {/* Quoted reply */}
          {replyPreview ? (
            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: 6,
                marginBottom: 6,
                borderLeftWidth: 3,
                borderLeftColor: isOwn ? '#8EA8FF' : '#8B8B8B',
                backgroundColor: '#0000000A',
                borderRadius: radius.md,
              }}
            >
              {replyPreview.thumbnailUrl ? (
                <Image
                  source={{ uri: replyPreview.thumbnailUrl }}
                  style={{ width: 34, height: 34, borderRadius: 4 }}
                  resizeMode="cover"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 11,
                    fontWeight: '700',
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {replyPreview.senderName}
                </Text>
                {replyPreview.snippet ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }} numberOfLines={2}>
                    {replyPreview.snippet}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Body */}
          {message.text ? <Text style={{ color: colors.textPrimary }}>{message.text}</Text> : null}

          {/* Footer */}
          {timeLabel ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 10,
                textAlign: 'right',
                marginTop: 2,
              }}
            >
              {timeLabel}
              {edited ? ' • edited' : ''}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {showDetails && (
        <Text
          style={{
            marginTop: 4,
            marginLeft: isOwn ? 0 : spacing.md,
            marginRight: isOwn ? spacing.md : 0,
            color: colors.textMuted,
            fontSize: 11,
            alignSelf: isOwn ? 'flex-end' : 'flex-start',
          }}
        >
          {isOwn ? 'You' : 'Message'} •{' '}
          {message.createdAt ? message.createdAt.toLocaleString() : 'time unknown'}
        </Text>
      )}
    </View>
  );
};

export default MessageBubble;
