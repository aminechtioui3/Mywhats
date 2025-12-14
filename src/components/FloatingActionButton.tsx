// src/components/FloatingActionButton.tsx
import React from 'react';
import { Pressable, View, Platform } from 'react-native';
import { colors, elevations, radius, spacing } from '../theme';

type Props = {
  icon: React.ReactNode;
  onPress: () => void;
  bottomOffset?: number; // allow screens to raise FAB above tabs if needed
};

const FloatingActionButton: React.FC<Props> = ({ icon, onPress, bottomOffset = 28 }) => {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: bottomOffset,
        right: 24,
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primary,
          borderWidth: 1,
          borderColor: '#22c55e22',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...Platform.select({
            android: { elevation: elevations.fab },
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 24 },
          }),
        })}
        android_ripple={{ color: '#00000022', borderless: true }}
      >
        {icon}
      </Pressable>
    </View>
  );
};

export default FloatingActionButton;
