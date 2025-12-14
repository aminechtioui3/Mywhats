// Deep-link config for React Navigation (Expo)
import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

const scheme = 'chtiouiwhatsapp'; // <-- change if you prefer another scheme
const host = 'yourapp.example';   // <-- change to your domain

// We’ll accept BOTH app-scheme and web URLs.
export const prefixes = [Linking.createURL('/'), `${scheme}://`, `https://${host}`];

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes,
  config: {
    screens: {
      // Your existing screens (add the ones you already have)
      Home: '',
      Chat: 'chat/:chatId?', // optional param

      // New:
      JoinChat: {
        path: 'join',
        // We expect ?code=XXXX in query
        parse: { code: (value: string) => value ?? '' },
        stringify: { code: (value: string) => value },
      },

      GroupSettings: 'group/:chatId/settings',
      GroupInvite: 'group/:chatId/invite',

      // Optional (if you have it)
      DirectChatSettings: 'direct/:chatId/settings',
    },
  },

  // Good practice on Expo to explicitly wire URL events:
  getInitialURL: async () => {
    const url = await Linking.getInitialURL();
    return url;
  },
  subscribe(listener) {
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    const sub = Linking.addEventListener('url', onReceiveURL);
    return () => sub.remove();
  },
};
