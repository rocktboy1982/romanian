"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export default function SignInButton() {
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    } catch (e) {
      console.error("Sign in error", e);
      push({ message: 'Autentificarea a eșuat', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      // page may keep state — reload to refresh server cookies
      window.location.reload();
    } catch (e) {
      console.error("Sign out failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button onClick={signInWithGoogle} variant="default" disabled={loading}>
        Conectează-te cu Google
      </Button>
      <Button onClick={signOut} variant="outline" disabled={loading}>
        Deconectează-te
      </Button>
    </div>
  );
}
