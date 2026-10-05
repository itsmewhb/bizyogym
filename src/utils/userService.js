import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/*
 * Get the Bizyo user profile using Firebase Auth UID
 */
export const getUserProfile = async (uid) => {
  if (!uid) {
    return null;
  }

  try {
    const userRef = doc(db, "users", uid);
    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {
      return null;
    }

    return {
      uid: userSnapshot.id,
      ...userSnapshot.data(),
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};

/*
 * Create or update a Bizyo user profile
 */
export const createUserProfile = async ({
  uid,
  name,
  email,
  role = "staff",
}) => {
  if (!uid) {
    throw new Error("User UID is required.");
  }

  const userRef = doc(db, "users", uid);

  await setDoc(
    userRef,
    {
      uid,
      name: name || "",
      email: email || "",
      role,
      status: "active",
      createdAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );

  return {
    uid,
    name: name || "",
    email: email || "",
    role,
    status: "active",
  };
};