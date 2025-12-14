// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  deleteUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db } from '../api/firebase';
import { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (phone: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Keep only a single leading '+' and digits (e.g. "+21699000000")
const normalizePhone = (raw: string) => {
  const trimmed = (raw || '').trim();
  const only = trimmed.replace(/[^\d+]/g, '');
  return only.replace(/(?!^)\+/g, '');
};

const phoneToEmail = (phone: string) => {
  const normalized = phone.replace(/\s+/g, '');
  return `${normalized}@Chtiouiwhatsapp.local`;
};

const mapUserDocToProfile = (id: string, data: any): UserProfile => {
  return {
    id,
    phone: data.phone ?? '',
    displayName: data.displayName ?? data.phone ?? 'User',
    email: data.email ?? (data.phone ? phoneToEmail(data.phone) : ''), // ✅ ensure email present
    avatarUrl: data.avatarUrl ?? '',
    statusMessage: data.statusMessage ?? 'Hey there! I am using ChtiouiWhatsApp.',
    lastSeen: data.lastSeen?.toDate ? data.lastSeen.toDate() : data.lastSeen ?? null,
    online: data.online ?? false,
    favoriteContactIds: data.favoriteContactIds ?? [],
    favoriteChatIds: data.favoriteChatIds ?? [],
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ?? null,
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser || null);

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(collection(db, 'users'), firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          const email = firebaseUser.email ?? '';
          const phoneFromEmail = email.includes('@') ? email.split('@')[0] : '';
          const phoneNormalized = normalizePhone(phoneFromEmail);

          const data = {
            phone: phoneFromEmail,
            phoneNormalized,
            email, // ✅ store email
            displayName: (firebaseUser.displayName ?? phoneFromEmail) || 'User',
            avatarUrl: '',
            statusMessage: 'Hey there! I am using ChtiouiWhatsApp.',
            online: true,
            favoriteChatIds: [] as string[],
            favoriteContactIds: [] as string[],
            createdAt: serverTimestamp(),
          };

          await setDoc(userRef, data);
          setProfile(mapUserDocToProfile(firebaseUser.uid, data));
        } else {
          const data = snap.data();
          // Presence + backfill normalized phone and email if missing
          await setDoc(
            userRef,
            {
              online: true,
              lastSeen: serverTimestamp(),
              ...(data.phone && !data.phoneNormalized
                ? { phoneNormalized: normalizePhone(data.phone) }
                : {}),
              ...(firebaseUser.email && !data.email ? { email: firebaseUser.email } : {}), // ✅ backfill email
            },
            { merge: true }
          );
          // re-read (or just reuse `data` with potential fallbacks)
          setProfile(mapUserDocToProfile(firebaseUser.uid, { ...data, email: data.email ?? firebaseUser.email }));
        }
      } catch (error) {
        console.warn('AuthContext: error loading profile', error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const deleteAccount = async () => {
    try {
      const currUser = auth.currentUser;
      const uid = currUser?.uid;
      if (!uid) {
        await firebaseSignOut(auth);
        setUser(null);
        setProfile(null);
        return;
      }

      try {
        const contactsCol = collection(db, 'users', uid, 'contacts');
        const contactsSnap = await getDocs(contactsCol);
        if (!contactsSnap.empty) {
          await Promise.all(contactsSnap.docs.map((d) => deleteDoc(d.ref)));
        }
      } catch (e) {
        console.warn('[AuthContext] delete contacts ignored:', e);
      }

      try {
        const userRef = doc(collection(db, 'users'), uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          await deleteDoc(userRef);
        }
      } catch (e) {
        console.warn('[AuthContext] delete user doc ignored:', e);
      }

      try {
        await deleteUser(currUser);
      } catch (e: any) {
        if (e?.code !== 'auth/requires-recent-login') {
          console.warn('[AuthContext] deleteUser error:', e);
        }
        // If requires recent login, we still proceed to sign out so UI goes to Auth
      }

      // 4) Always sign out locally
      await firebaseSignOut(auth);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const signUp = async (phone: string, password: string, displayName: string) => {
    const email = phoneToEmail(phone);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userRef = doc(collection(db, 'users'), cred.user.uid);

    await setDoc(userRef, {
      phone,
      phoneNormalized: normalizePhone(phone),
      email, // ✅ store email at signup
      displayName,
      avatarUrl: '',
      statusMessage: 'Hey there! I am using ChtiouiWhatsApp.',
      online: true,
      createdAt: serverTimestamp(),
      favoriteChatIds: [],
      favoriteContactIds: [],
    });
  };

  const signIn = async (phone: string, password: string) => {
    const email = phoneToEmail(phone);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    try {
      if (auth.currentUser) {
        const userRef = doc(collection(db, 'users'), auth.currentUser.uid);
        await setDoc(
          userRef,
          { online: false, lastSeen: serverTimestamp() },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('[AuthContext] signOut presence update skipped:', err);
    }
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
