// src/navigation/RootNavigator.tsx
import React from 'react';
import { ActivityIndicator, View, Pressable } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Linking from 'expo-linking';

import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import SignupScreen from '../screens/auth/SignupScreen';

import HomeScreen from '../screens/main/HomeScreen';
import ContactsScreen from '../screens/main/ContactsScreen';
import ChatsScreen from '../screens/main/ChatsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

import ChatScreen from '../screens/chat/ChatScreen';
import NewChatScreen from '../screens/chat/NewChatScreen';
import ContactDetailsScreen from '../screens/chat/ContactDetailsScreen';
import GroupSettingsScreen from '../screens/chat/GroupSettingsScreen';

import GroupInviteScreen from '../screens/chat/GroupInviteScreen';
import JoinChatScreen from '../screens/chat/JoinChatScreen';
import QRScanScreen from '../screens/qr/QrScanScreen';
import MyQrScreen from '../screens/qr/MyQrScreen';

import { colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ✅ Root navigation ref (lets us navigate from anywhere if needed)
export const rootNavigationRef = createNavigationContainerRef<any>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.primary,
  },
};

const AuthNavigator = () => (
  <AuthStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Signup" component={SignupScreen} />
  </AuthStack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    id={undefined}
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.backgroundElevated,
        borderTopColor: colors.border,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarIcon: ({ color, size }) => {
        let icon = 'home-outline';
        if (route.name === 'HomeTab') icon = 'home-outline';
        if (route.name === 'ContactsTab') icon = 'people-outline';
        if (route.name === 'ChatsTab') icon = 'chatbubble-ellipses-outline';
        if (route.name === 'ProfileTab') icon = 'person-outline';
        return <Ionicons name={icon as any} size={size} color={color} />;
      },
      tabBarLabelStyle: { fontSize: 12 },
    })}
  >
    <Tab.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="ContactsTab" component={ContactsScreen} options={{ title: 'Contacts' }} />
    <Tab.Screen name="ChatsTab" component={ChatsScreen} options={{ title: 'Chats' }} />
    <Tab.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

const modalHeader = (navigation: any, title: string) => ({
  headerShown: true,
  title,
  presentation: 'containedModal' as const,
  animation: 'slide_from_bottom' as const,
  headerLeft: () => (
    <Pressable
      onPress={() => {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('MainTabs', { screen: 'ChatsTab' });
      }}
      style={{ paddingHorizontal: 8 }}
    >
      <Ionicons name="close" size={22} color={colors.textPrimary} />
    </Pressable>
  ),
});

const AppNavigator = () => (
  <AppStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
    <AppStack.Screen name="MainTabs" component={MainTabs} />
    <AppStack.Screen name="Chat" component={ChatScreen} />
    <AppStack.Screen name="NewChat" component={NewChatScreen} />
    <AppStack.Screen name="ContactDetails" component={ContactDetailsScreen} />
    <AppStack.Screen name="GroupSettings" component={GroupSettingsScreen} />
    <AppStack.Screen name="GroupInvite" component={GroupInviteScreen} />
    <AppStack.Screen name="JoinChat" component={JoinChatScreen} />

    {/* 🔹 Scanner screens */}
    {/* Primary canonical name */}
    <AppStack.Screen
      name="QRScan"
      component={QRScanScreen}
      options={({ navigation }) => modalHeader(navigation, 'Scan')}
    />
    {/* 🔹 Alias to fix calls like navigation.navigate('QrScan') (case-sensitive) */}
    <AppStack.Screen
      name="QrScan"
      component={QRScanScreen}
      options={({ navigation }) => modalHeader(navigation, 'Scan')}
    />

    {/* Alias route if you navigate to 'MyQr' elsewhere */}
    <AppStack.Screen
      name="MyQr"
      component={MyQrScreen}
      options={({ navigation }) => modalHeader(navigation, 'My QR')}
    />
  </AppStack.Navigator>
);

/** Deep linking */
const PREFIXES = [Linking.createURL('/'), 'chtiouiwhatsapp://', 'https://yourapp.example'];

const sanitizeJoinUrl = (url?: string | null) => {
  if (!url) return url ?? undefined;
  try {
    const u = new URL(url);
    if (u.pathname.replace(/^\/+/, '') === 'join') {
      const code = u.searchParams.get('code');
      const legacy = u.searchParams.get('c');
      if (!code && legacy) {
        u.searchParams.delete('c');
        u.searchParams.set('code', legacy);
        return u.toString();
      }
    }
  } catch {}
  return url;
};

const linking = {
  prefixes: PREFIXES,
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Signup: 'signup',
        },
      },
      App: {
        screens: {
          MainTabs: {
            screens: {
              HomeTab: 'home',
              ContactsTab: 'contacts',
              ChatsTab: 'chats',
              ProfileTab: 'profile',
            },
          },
          Chat: 'chat/:chatId?',
          NewChat: 'new',
          ContactDetails: 'contact/:contactUserId',
          GroupSettings: 'group/:chatId/settings',
          GroupInvite: 'group/:chatId/invite',
          DirectChatSettings: 'direct/:chatId/settings',
          JoinChat: { path: 'join', parse: { code: (v: string) => v ?? '' } },
          // We map only the canonical one here; alias is for in-app navigation
          QRScan: 'scan',
          MyQr: 'myqr',
        },
      },
    },
  },
  getInitialURL: async () => sanitizeJoinUrl(await Linking.getInitialURL()),
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) =>
      listener(sanitizeJoinUrl(url) || url);
    const sub = Linking.addEventListener('url', onReceiveURL);
    return () => sub.remove();
  },
};

export const RootNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    // @ts-ignore
    <NavigationContainer
      theme={navigationTheme}
      linking={linking}
      ref={rootNavigationRef}
    >
      <RootStack.Navigator id={undefined} screenOptions={{ headerShown: false }}>
        {user ? (
          <RootStack.Screen name="App" component={AppNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};
