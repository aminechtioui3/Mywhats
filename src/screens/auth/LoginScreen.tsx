// src/screens/main/LoginScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<any>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneError = useMemo(
    () => (phone.length === 0 ? undefined : phone.trim().length < 6 ? 'Enter a valid phone' : undefined),
    [phone]
  );

  const passwordError = useMemo(
    () =>
      password.length === 0
        ? undefined
        : password.trim().length < 6
        ? 'Password must be at least 6 characters'
        : undefined,
    [password]
  );

  const canSubmit = phone.trim() && password.trim() && !phoneError && !passwordError && !submitting;

  const handleLogin = async () => {
    if (!phone || !password) {
      setError('Please enter phone and password');
      return;
    }
    if (phoneError || passwordError) return;

    setError(null);
    setSubmitting(true);
    try {
      await signIn(phone.trim(), password.trim());
    } catch (e: any) {
      setError(e?.message ?? 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      {/* Decorative light hero */}
      <View style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: '#F1F5FF' }} />
      <View style={{ position: 'absolute', top: 140, left: -100, width: 180, height: 180, borderRadius: 90, backgroundColor: '#F8FAFF' }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          {/* Brand / Heading */}
          <View style={{ marginTop: spacing.xl * 0.5, marginBottom: spacing.lg }}>
            <Text
              style={{
                color: colors.primary,
                fontSize: typography.h1,
                fontWeight: '800',
                letterSpacing: 0.5,
              }}
            >
              Chtiouis
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
              Welcome back — sign in to continue.
            </Text>
          </View>

          {/* Card */}
          <View
            style={{
              backgroundColor: colors.backgroundElevated,
              borderRadius: radius.xl,
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }}
          >
            {/* Phone */}
            <LabeledInput
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+216 20 000 000"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoCapitalize="none"
              leftIcon="call-outline"
              errorText={phoneError}
            />

            {/* Password */}
            <LabeledInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              textContentType="password"
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
              rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
              onRightIconPress={() => setShowPassword((s) => !s)}
              errorText={passwordError}
              containerStyle={{ marginTop: spacing.md }}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />

            {/* Error banner */}
            {error ? (
              <View
                style={{
                  marginTop: spacing.sm,
                  borderRadius: radius.lg,
                  backgroundColor: '#FFF1F2',
                  borderWidth: 1,
                  borderColor: '#FECDD3',
                  padding: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="warning-outline" size={16} color={colors.danger} />
                <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>
              </View>
            ) : null}

            {/* Actions */}
            <View
              style={{
                marginTop: spacing.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Pressable onPress={() => { /* hook up later */ }}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Forgot password?</Text>
              </Pressable>

              <Pressable
                onPress={handleLogin}
                disabled={!canSubmit}
                style={{
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: canSubmit ? colors.primary : '#E7ECF5',
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: '800',
                    letterSpacing: 0.3,
                  }}
                >
                  {submitting ? 'Logging in…' : 'Login'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Divider */}
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              marginVertical: spacing.lg,
              gap: spacing.sm,
            }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Sign up prompt */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary }}>
              New here?{' '}
              <Text
                onPress={() => navigation.navigate('Signup')}
                style={{ color: colors.primary, fontWeight: '700' }}
              >
                Create account
              </Text>
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

/* ----------------------------- */
/* Local polished input component */
/* ----------------------------- */

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  textContentType,
  autoCapitalize,
  secureTextEntry,
  leftIcon,
  rightIcon,
  onRightIconPress,
  errorText,
  containerStyle,
  onSubmitEditing,
  returnKeyType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
  textContentType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  leftIcon?: any;
  rightIcon?: any;
  onRightIconPress?: () => void;
  errorText?: string | undefined;
  containerStyle?: any;
  onSubmitEditing?: () => void;
  returnKeyType?: any;
}) {
  const hasError = !!errorText;

  return (
    <View style={containerStyle}>
      <Text style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 12 }}>
        {label}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.xl,
          borderWidth: 1.5,
          borderColor: hasError ? colors.danger : colors.border,
          backgroundColor: colors.background,
          paddingHorizontal: spacing.md,
          paddingVertical: Platform.select({ ios: spacing.sm, android: spacing.sm }),
        }}
      >
        {leftIcon ? (
          <Ionicons
            name={leftIcon}
            size={18}
            color={hasError ? colors.danger : colors.textMuted}
            style={{ marginRight: spacing.sm }}
          />
        ) : null}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          style={{
            flex: 1,
            color: colors.textPrimary,
            paddingVertical: Platform.select({ ios: 8, android: 6 }),
          }}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
        />

        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={8}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F6F8FD',
              borderWidth: 1,
              borderColor: '#E7ECF5',
              marginLeft: spacing.sm,
            }}
          >
            <Ionicons name={rightIcon} size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {hasError ? (
        <Text style={{ color: colors.danger, fontSize: 12, marginTop: 6 }}>{errorText}</Text>
      ) : null}
    </View>
  );
}
