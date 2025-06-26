"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/utils/firebase";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/sign-in");
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  return { user, loading };
}

export function useRedirectIfAuthenticated(redirectTo = "/dashboard/home") {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(redirectTo);
      }
    });
    return () => unsubscribe();
  }, [router, redirectTo]);
}
