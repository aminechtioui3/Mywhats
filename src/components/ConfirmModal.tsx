// src/components/ConfirmModal.tsx
import React from 'react';
import { Modal, View, Text, Pressable, Platform } from 'react-native';
import { colors, radius, spacing, typography, elevations } from '../theme';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const ConfirmModal: React.FC<Props> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 520,
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            ...Platform.select({
              android: { elevation: elevations.modal },
              ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24 },
            }),
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: danger ? '#7F1D1D' : '#052E2B',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Ionicons
                name={danger ? 'trash-outline' : 'alert-circle-outline'}
                size={26}
                color={danger ? colors.danger : colors.primary}
              />
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: typography.h3,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {title}
            </Text>
            {message ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: spacing.sm,
                  textAlign: 'center',
                }}
              >
                {message}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row' }}>
            <Pressable
              onPress={onCancel}
              style={{
                flex: 1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: spacing.md,
                alignItems: 'center',
                marginRight: spacing.sm,
              }}
              android_ripple={{ color: '#ffffff22', borderless: false }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                borderRadius: radius.lg,
                backgroundColor: danger ? colors.danger : colors.primary,
                paddingVertical: spacing.md,
                alignItems: 'center',
                marginLeft: spacing.sm,
              }}
              android_ripple={{ color: '#00000022', borderless: false }}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmModal;
