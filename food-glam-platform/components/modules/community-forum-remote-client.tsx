"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from '@/lib/supabase-client'
import { useFeatureFlags } from "@/components/feature-flags-provider";

/* ── Types ─────────────────────────────────────────────── */
interface Thread {
  id: string;
  title: string;
  body: string | null;
  author_id: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
}

interface Reply {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

/* ── Helpers ───────────────────────────────────────────── */
function getMockUserId(): string {
  try {
    return JSON.parse(localStorage.getItem("mock_user") ?? "{}").id ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Primary: read from our persisted session
  try {
    const backup = localStorage.getItem('marechef-session')
    if (backup) {
      const parsed = JSON.parse(backup)
      if (parsed?.access_token) {
        headers["Authorization"] = "Bearer " + parsed.access_token
        return headers
      }
    }
  } catch {}
  // Fallback: try Supabase client
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) headers["Authorization"] = "Bearer " + session.access_token;
  return headers;
}

/* ── Component ─────────────────────────────────────────── */
export default function CommunityForumRemoteClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(false);

  // New thread form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Expanded thread (replies)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  /* ── Fetch threads ─────────────────────────────────── */
  const fetchThreads = useCallback(async () => {
    setLoadingRemote(true);
    try {
      const res = await fetch("/api/threads", { headers: await authHeaders() });
      if (res.ok) {
        const json = (await res.json()) as { threads: Thread[] };
        setThreads(json.threads);
      }
    } catch {
      /* offline — keep whatever we have */
    } finally {
      setLoadingRemote(false);
    }
  }, []);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  /* ── Create thread ─────────────────────────────────── */
  const createThread = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ title: title.trim(), body: body.trim() || null }),
      });
      if (res.status === 429) {
        setRateLimited(true);
        const json = (await res.json()) as { error: string };
        setErrorMsg(json.error);
        return;
      }
      if (!res.ok) {
        const json = (await res.json()) as { error: string };
        setErrorMsg(json.error);
        return;
      }
      setTitle("");
      setBody("");
      await fetchThreads();
    } catch {
      setErrorMsg("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Expand thread / fetch replies ─────────────────── */
  const toggleExpand = async (threadId: string) => {
    if (expandedId === threadId) {
      setExpandedId(null);
      setReplies([]);
      return;
    }
    setExpandedId(threadId);
    setReplies([]);
    try {
      const res = await fetch(`/api/replies?thread_id=${threadId}`, { headers: await authHeaders() });
      if (res.ok) {
        const json = (await res.json()) as { replies: Reply[] };
        setReplies(json.replies);
      }
    } catch {
      /* silent */
    }
  };

  /* ── Create reply ──────────────────────────────────── */
  const createReply = async (threadId: string) => {
    if (!replyBody.trim()) return;
    setReplySubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/replies", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ thread_id: threadId, body: replyBody.trim() }),
      });
      if (res.status === 429) {
        setRateLimited(true);
        const json = (await res.json()) as { error: string };
        setErrorMsg(json.error);
        return;
      }
      if (!res.ok) {
        const json = (await res.json()) as { error: string };
        setErrorMsg(json.error);
        return;
      }
      setReplyBody("");
      // Re-fetch replies
      const rRes = await fetch(`/api/replies?thread_id=${threadId}`, { headers: await authHeaders() });
      if (rRes.ok) {
        const json = (await rRes.json()) as { replies: Reply[] };
        setReplies(json.replies);
      }
    } catch {
      setErrorMsg("Network error — please try again.");
    } finally {
      setReplySubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────── */
  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">Community Forum</h2>

        {/* Rate limit banner */}
        {rateLimited && (
          <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            Daily limit reached. You can post again tomorrow.
          </div>
        )}

        {/* Error banner */}
        {errorMsg && !rateLimited && (
          <div className="mt-2 rounded bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm text-yellow-800">
            {errorMsg}
          </div>
        )}

        {/* New thread form */}
        {!rateLimited && (
          <div className="mt-2 flex flex-col gap-2">
            <input
              className="border rounded px-2 py-1"
              placeholder="Thread title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="border rounded px-2 py-1"
              placeholder="Body (optional)"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
            />
            <div>
              <button
                className="bg-primary text-white px-3 py-1 rounded disabled:opacity-50"
                onClick={createThread}
                disabled={submitting || !title.trim()}
              >
                {submitting ? "Creating..." : "Create Thread"}
              </button>
            </div>
          </div>
        )}
      </div>

      {loadingRemote && (
        <div className="text-sm text-muted-foreground mb-2">Loading threads...</div>
      )}

      {/* Thread list */}
      <ul className="space-y-3">
        {threads.map((t) => (
          <li key={t.id} className="border rounded overflow-hidden">
            {/* Thread header */}
            <button
              className="w-full text-left p-3 hover:bg-muted/30 transition-colors"
              onClick={() => toggleExpand(t.id)}
            >
              <div className="flex items-center gap-2">
                {t.is_pinned && <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 rounded">Pinned</span>}
                {t.is_locked && <span className="text-xs bg-gray-100 text-gray-600 px-1.5 rounded">Locked</span>}
                <span className="font-medium">{t.title}</span>
              </div>
              {t.body && (
                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.body}</div>
              )}
              <div className="text-xs text-muted-foreground mt-2">
                {new Date(t.created_at).toLocaleString()}
              </div>
            </button>

            {/* Expanded: replies */}
            {expandedId === t.id && (
              <div className="border-t px-3 py-2 bg-muted/10">
                {replies.length === 0 && (
                  <div className="text-sm text-muted-foreground py-2">No replies yet.</div>
                )}
                {replies.map((r) => (
                  <div key={r.id} className="py-2 border-b last:border-0">
                    <div className="text-sm">{r.body}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}

                {/* Reply form */}
                {!t.is_locked && !rateLimited && (
                  <div className="mt-2 flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      placeholder="Write a reply..."
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                    />
                    <button
                      className="bg-primary text-white px-3 py-1 rounded text-sm disabled:opacity-50"
                      onClick={() => createReply(t.id)}
                      disabled={replySubmitting || !replyBody.trim()}
                    >
                      {replySubmitting ? "..." : "Reply"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!loadingRemote && threads.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-8">
          No threads yet. Be the first to start a discussion!
        </div>
      )}
    </div>
  );
}
