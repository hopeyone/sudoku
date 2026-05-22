import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { firebaseEnabled, getFirebase } from './firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

// Subscribe to Firebase auth state. Returns { user, loading }.
// When firebase isn't configured, returns { user: null, loading: false }.
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    loading: firebaseEnabled,
  }));

  useEffect(() => {
    if (!firebaseEnabled) return;
    const { auth } = getFirebase();
    return onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false });
    });
  }, []);

  return state;
}
