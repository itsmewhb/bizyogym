import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        try {
          if (!firebaseUser) {
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setUser(firebaseUser);

          // Get the Bizyo profile using the Firebase Auth UID
          const userRef = doc(db, "users", firebaseUser.uid);
          const userSnapshot = await getDoc(userRef);

          if (!userSnapshot.exists()) {
            console.error(
              "No Bizyo user profile found for this account.",
            );

            setUserProfile(null);
            setLoading(false);
            return;
          }

          const profile = {
            uid: userSnapshot.id,
            ...userSnapshot.data(),
          };

          /*
           * Only STAFF accounts are affected by the
           * Active / Inactive status.
           *
           * Admin accounts are not blocked by this check.
           *
           * If an older staff account has no status field,
           * it will be treated as Active.
           */
          const isInactiveStaff =
            profile.role === "staff" &&
            profile.status === "Inactive";

          if (isInactiveStaff) {
            console.warn("Bizyo staff account is inactive.");

            await signOut(auth);

            setUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setUserProfile(profile);
        } catch (error) {
          console.error(
            "Error loading user profile:",
            error,
          );

          setUser(null);
          setUserProfile(null);
        } finally {
          setLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);

      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  };

  const isAdmin = userProfile?.role === "admin";
  const isStaff = userProfile?.role === "staff";

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        isAdmin,
        isStaff,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside an AuthProvider.",
    );
  }

  return context;
}