"use client";

import { useEffect, useState } from "react";
import { auth, provider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

const SUPER_ADMIN = process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || "mgodimgodi6@gmail.com";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized">("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === SUPER_ADMIN) {
        setStatus("authorized");
      } else if (user) {
        signOut(auth);
        setStatus("unauthorized");
      } else {
        signInWithPopup(auth, provider).catch(console.error);
      }
    });

    return () => unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#0f0f1a", color: "#e94560",
        flexDirection: "column", gap: "1rem", fontFamily: "sans-serif"
      }}>
        <div style={{ fontSize: "3rem" }}>🛡️</div>
        <p>Verifying identity...</p>
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#0f0f1a", color: "#ef4444",
        flexDirection: "column", gap: "1rem", fontFamily: "sans-serif"
      }}>
        <div style={{ fontSize: "3rem" }}>⛔</div>
        <p>Access Denied</p>
      </div>
    );
  }

  return <>{children}</>;
}