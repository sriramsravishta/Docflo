import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: any;
  role: string;
  orgId: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>('Doctor');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Session retrieval error:', error.message);
          // If refresh token is invalid, clear the session
          if (error.message.includes('Invalid Refresh Token') || error.message.includes('Refresh Token Not Found')) {
            await supabase.auth.signOut();
          }
          setUser(null);
                } else {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
                   if (currentUser) {
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('role, org_id')
                .eq('auth_id', currentUser.id)
                .single();
              if (userData) {
                setRole(userData.role || 'Doctor');
                setOrgId(userData.org_id || null);
              }
            } catch (e) {
              console.warn('Could not fetch user role:', e);
            }
          }
        }
      } catch (error) {
        console.warn('Unexpected session error:', error);
        // Clear any invalid session state
        await supabase.auth.signOut();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
            if (currentUser) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role, org_id')
            .eq('auth_id', currentUser.id)
            .single();
          if (userData) {
            setRole(userData.role || 'Doctor');
            setOrgId(userData.org_id || null);
          }
                } catch (e) {
          console.warn('Could not fetch user role:', e);
        }
      } else {
        setRole('Doctor');
        setOrgId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

       if (error) throw error;
    setUser(data.user);
        if (data.user) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('role, org_id')
          .eq('auth_id', data.user.id)
          .single();
        if (userData) {
          setRole(userData.role || 'Doctor');
          setOrgId(userData.org_id || null);
        }
      } catch (e) {
        console.warn('Could not fetch user role:', e);
      }
    }
  };

  const signUp = async (name: string, email: string, password: string, phone?: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
        },
      },
    });

    if (authError) throw authError;

    if (authData.user) {
      const { error: orgError } = await supabase
        .from('organizations')
        .insert({
          auth_id: authData.user.id,
          name: name,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { data: orgData } = await supabase
        .from('organizations')
        .select('id')
        .eq('auth_id', authData.user.id)
        .limit(1)
        .single();

      if (orgData) {
        const { error: userError } = await supabase
          .from('users')
          .insert({
            auth_id: authData.user.id,
            org_id: orgData.id,
            role: 'Doctor',
          });

        if (userError) throw userError;
      }
    }

    await supabase.auth.signOut();
  };

  const signOut = async () => {
  await supabase.auth.signOut({ scope: 'local' });
};

  return (
        <AuthContext.Provider value={{ user, role, orgId, signIn, signUp, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
