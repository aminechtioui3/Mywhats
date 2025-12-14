import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { colors, radius, shadowCard } from '../theme';

interface AvatarProps {
    name: string;
    size?: number;
    uri?: string;
    onPress?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ name, size = 44, uri, onPress }) => {
    const initial = name?.trim()?.[0]?.toUpperCase?.() ?? '?';

    const content = uri ? (
        <Image
            source={{ uri }}
            style={{
                width: size,
                height: size,
                borderRadius: radius.full,
            }}
        />
    ) : (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: radius.full,
                backgroundColor: colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                ...shadowCard,
            }}
        >
            <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: size * 0.45 }}>
                {initial}
            </Text>
        </View>
    );

    if (onPress) {
        return (
            <Pressable onPress={onPress} style={{ borderRadius: radius.full }}>
                {content}
            </Pressable>
        );
    }

    return content;
};

export default Avatar;
