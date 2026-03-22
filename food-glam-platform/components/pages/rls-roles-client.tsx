"use client";

import React from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function RLSRolesClient() {
  const { flags, loading } = useFeatureFlags();
  if (loading) return <div className="container mx-auto px-4 py-8">Se încarcă...</div>;
  const admin = false;
  const moderator = false;
  const user = true;

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Security: Roles & RLS</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="mb-4">
            <li>User: {user ? "Active" : "Inactive"}</li>
            <li>Moderator: {moderator ? "Active" : "Inactive"}</li>
            <li>Admin: {admin ? "Active" : "Inactive"}</li>
          </ul>
          <p className="text-muted-foreground">Your role determines access to moderation, admin tools, and private data. Row-level security (RLS) protects sensitive information.</p>
        </CardContent>
      </Card>
    </main>
  );
}
