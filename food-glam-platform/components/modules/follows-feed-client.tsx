"use client";
import React, { useEffect, useState } from "react";
import { useFeatureFlags } from "@/components/feature-flags-provider";

export default function FollowsFeedClient() {
  const { flags, loading } = useFeatureFlags();
  const powerMode = !!flags.powerMode;
  const [follows, setFollows] = useState<string[]>([]);
  const [posts, setPosts] = useState<{author:string, text:string}[]>([]);
  const [text, setText] = useState("");
  const [showFollowInput, setShowFollowInput] = useState(false);
  const [followName, setFollowName] = useState("");

  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_follows'); if(raw) setFollows(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ const raw = localStorage.getItem('dev_posts'); if(raw) setPosts(JSON.parse(raw)); }catch(e){} },[]);
  useEffect(()=>{ try{ localStorage.setItem('dev_follows', JSON.stringify(follows)); }catch(e){} },[follows]);
  useEffect(()=>{ try{ localStorage.setItem('dev_posts', JSON.stringify(posts)); }catch(e){} },[posts]);

  if (loading) return <div>Se încarcă...</div>;
  if (!powerMode) return null;

  const addFollow = () => {
    const name = showFollowInput ? followName.trim() : "";
    if (!showFollowInput) {
      setShowFollowInput(true);
      return;
    }
    if (!name) return;
    setFollows((s)=>Array.from(new Set([...s, name])));
    setFollowName("");
    setShowFollowInput(false);
  };

  const addPost = () => {
    if (!text.trim()) return;
    setPosts((s)=>[{author:'you', text:text.trim()}, ...s]);
    setText('');
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
      <div className="mb-4">
        <div className="font-semibold">Following</div>
        <div className="text-sm text-muted-foreground">{follows.length===0 ? 'You are not following anyone yet.' : follows.join(', ')}</div>
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
