"use client";

import React, { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useFeatureFlags } from "@/components/feature-flags-provider";
import { supabase } from "@/lib/supabase-client";
import { unwrapSupabase } from '@/lib/supabase-utils';
import { Database } from '@/types/supabase';

type Follow = { id?: string; username: string };
type Post = { id?: string; author: string; text: string };

export default function FollowsFeedRemoteClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [follows, setFollows] = useState<Follow[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [showFollowInput, setShowFollowInput] = useState(false);
  const [followName, setFollowName] = useState("");
  const { push } = useToast();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingRemote(true);
      try {
        const resF = await supabase.from('follows').select('follower_id,followed_id');
        const resP = await supabase.from('posts').select('id,created_by,text').order('id', { ascending: false }).limit(50);
        const { data: fdata, error: ferr } = unwrapSupabase<any[]>(resF);
        const { data: pdata, error: perr } = unwrapSupabase<any[]>(resP);
        if (!mounted) return;
        if (ferr || perr) {
          const rawF = localStorage.getItem('dev_follows');
          if (rawF) setFollows(JSON.parse(rawF));
          const rawP = localStorage.getItem('dev_posts');
          if (rawP) setPosts(JSON.parse(rawP));
        } else {
          setFollows((fdata || []).map((r: any) => ({ username: r.followed_id })) || []);
          setPosts((pdata || []).map((r: any) => ({ id: r.id, author: r.created_by, text: r.text })) || []);
        }
      } catch (e) {
        const rawF = localStorage.getItem('dev_follows');
        if (rawF) setFollows(JSON.parse(rawF));
        const rawP = localStorage.getItem('dev_posts');
        if (rawP) setPosts(JSON.parse(rawP));
      } finally {
        setLoadingRemote(false);
      }
    }
    load();
    return () => { mounted = false };
  }, []);

  useEffect(() => { try { localStorage.setItem('dev_follows', JSON.stringify(follows)); } catch (e) {} }, [follows]);
  useEffect(() => { try { localStorage.setItem('dev_posts', JSON.stringify(posts)); } catch (e) {} }, [posts]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const addFollow = async () => {
    const name = showFollowInput ? followName.trim() : "";
    if (!showFollowInput) { setShowFollowInput(true); return; }
    if (!name) return;
    try {
      const res = await (supabase as any).from('follows').insert({ follower_id: 'you', followed_id: name }).select();
      const { data, error } = unwrapSupabase<any>(res);
      if (error) setFollows((s) => Array.from(new Set([...s, { username: name }]))); else setFollows((s) => [{ username: name }, ...s]);
    } catch (e) { setFollows((s) => Array.from(new Set([...s, { username: name }]))); push({ message: 'Follow failed', type: 'error' }); }
    setFollowName(""); setShowFollowInput(false);
  };

  const addPost = async () => {
    if (!text.trim()) return;
    const newPost = { author: 'you', text: text.trim() };
    setText('');
    try {
      const res = await (supabase as any).from('posts').insert({ created_by: 'you', text: newPost.text }).select('id,created_by,text').single();
      const { data, error } = unwrapSupabase<any>(res);
      if (error || !data) { setPosts((s) => [newPost, ...s]); } else { setPosts((s) => [{ id: data.id, author: data.created_by, text: data.text }, ...s]); }
    } catch (e) { setPosts((s) => [newPost, ...s]); }
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <div className="flex gap-2">
          {showFollowInput ? (
            <input className="rounded border px-2 py-1" value={followName} onChange={(e)=>setFollowName(e.target.value)} placeholder="username" />
          ) : null}
          <button className="bg-primary text-white px-3 rounded" onClick={addFollow}>{showFollowInput ? 'Add' : 'Follow'}</button>
          {showFollowInput ? <button className="bg-muted px-3 rounded" onClick={() => { setShowFollowInput(false); setFollowName(""); }}>Cancel</button> : null}
        </div>
        <input className="flex-1 rounded border px-2 py-1" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Write a post" />
        <button className="bg-primary text-white px-3 rounded" onClick={addPost}>Post</button>
      </div>
      {loadingRemote && <div className="text-sm text-muted-foreground mb-2">Syncing with Supabase...</div>}
      <div className="mb-4">
        <div className="font-semibold">Following</div>
        <div className="text-sm text-muted-foreground">{follows.length===0 ? 'You are not following anyone yet.' : follows.map(f=>f.username).join(', ')}</div>
      </div>
      <div>
        <div className="font-semibold mb-2">Feed</div>
        <div className="space-y-3">
          {posts.map((p, i)=> (
            <div key={i} className="rounded border p-3">
              <div className="font-semibold">{p.author}</div>
              <div className="text-sm">{p.text}</div>
            </div>
          ))}
          {posts.length===0 && <div className="text-muted-foreground">No posts yet.</div>}
        </div>
      </div>
    </div>
  );
}
