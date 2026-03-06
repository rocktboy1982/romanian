"use client";

import React, { useState, useEffect } from "react";

/**
 * Star level derived from vote count.
 * Uses a log scale so the first few votes matter most.
 *
 * Thresholds (cumulative votes → stars):
 *   0        → 0 stars
 *   1–9      → 1 star
 *   10–29    → 2 stars
 *   30–69    → 3 stars
 *   70–149   → 4 stars
 *   150+     → 5 stars
 */
export function votesToStars(votes: number): number {
  if (votes <= 0) return 0;
  if (votes < 10) return 1;
  if (votes < 30) return 2;
  if (votes < 70) return 3;
  if (votes < 150) return 4;
  return 5;
}

/** Fractional fill for the partial star at the boundary edge */
function starFill(starIndex: number, votes: number): "full" | "partial" | "empty" {
  const thresholds = [0, 1, 10, 30, 70, 150];
  const fullStars = votesToStars(votes);
  if (starIndex < fullStars) return "full";
  if (starIndex === fullStars && votes > 0) {
    // Show partial fill for the next star based on progress to next threshold
    const lo = thresholds[fullStars] ?? 150;
    const hi = thresholds[fullStars + 1] ?? 300;
    if (hi > lo && votes >= lo) return "partial";
  }
  return "empty";
}

function StarIcon({
  fill,
  size = 20,
}: {
  fill: "full" | "partial" | "empty";
  size?: number;
}) {
  const id = `partial-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {fill === "partial" && (
        <defs>
          <linearGradient id={id}>
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={
          fill === "full"
            ? "#f59e0b"
            : fill === "partial"
            ? `url(#${id})`
            : "none"
        }
        stroke={fill === "empty" ? "#d1d5db" : "#f59e0b"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Read-only star display — used in the hero badge */
export function StarDisplay({
  votes,
  size = 16,
  showCount = true,
}: {
  votes: number;
  size?: number;
  showCount?: boolean;
}) {
  const stars = votesToStars(votes);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} fill={starFill(i, votes)} size={size} />
        ))}
      </span>
      {showCount && (
        <span className="text-xs font-medium" style={{ color: "#92400e" }}>
          {votes.toLocaleString()} {votes !== 1 ? "voturi" : "vot"}
        </span>
      )}
    </span>
  );
}

interface RecipeRatingProps {
  recipeId: string;
  initialVotes: number;
  initialQualityScore: number;
}

type VoteState = "up" | "down" | null;

export default function RecipeRating({
  recipeId,
  initialVotes,
  initialQualityScore,
}: RecipeRatingProps) {
  const storageKey = `recipe_vote_${recipeId}`;

  const [votes, setVotes] = useState(initialVotes);
  const [qualityScore, setQualityScore] = useState(initialQualityScore);
  const [userVote, setUserVote] = useState<VoteState>(null);
  const [animating, setAnimating] = useState<VoteState>(null);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          vote: VoteState;
          votes: number;
          qualityScore: number;
        };
        setUserVote(parsed.vote);
        setVotes(parsed.votes);
        setQualityScore(parsed.qualityScore);
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const handleVote = (direction: "up" | "down") => {
    let newVotes = votes;
    let newVote: VoteState;

    if (userVote === direction) {
      // Undo vote
      newVotes = direction === "up" ? votes - 1 : votes + 1;
      newVote = null;
    } else {
      if (userVote !== null) {
        // Switching vote: undo old + apply new
        newVotes = direction === "up" ? votes + 2 : votes - 2;
      } else {
        newVotes = direction === "up" ? votes + 1 : votes - 1;
      }
      newVote = direction;
    }

    // Clamp to 0
    newVotes = Math.max(0, newVotes);

    // Recalculate quality score: normalize votes → 1–5 range
    const newScore = parseFloat(
      Math.min(5, Math.max(1, 1 + (newVotes / Math.max(newVotes, 50)) * 4)).toFixed(1)
    );

    setVotes(newVotes);
    setQualityScore(newScore);
    setUserVote(newVote);

    // Animate
    setAnimating(direction);
    setTimeout(() => setAnimating(null), 300);

    // Persist
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ vote: newVote, votes: newVotes, qualityScore: newScore })
      );
    } catch {
      // ignore
    }
  };

  const stars = votesToStars(votes);
  const starLabels = ["", "Începând", "Câștigând fani", "Alegerea comunității", "Favorit al fanilor", "Sala faimei"];

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.08)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#555" }}>
          Evaluare comunitate
        </h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: "#fef3c7", color: "#92400e" }}>
          {qualityScore.toFixed(1)} / 5.0
        </span>
      </div>

      {/* Stars */}
      <div className="flex flex-col items-center gap-1.5 py-1">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon key={i} fill={starFill(i, votes)} size={28} />
          ))}
        </div>
        <span className="text-xs font-medium" style={{ color: "#92400e" }}>
          {stars > 0 ? starLabels[stars] : "Fii primul care votează!"}
        </span>
      </div>

      {/* Vote count */}
      <div className="text-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color: "#111" }}>
          {votes.toLocaleString()}
        </span>
        <span className="text-sm ml-1.5" style={{ color: "#888" }}>
          vot{votes !== 1 ? "uri" : ""}
        </span>
      </div>

      {/* Up / Down buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleVote("up")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: userVote === "up" ? "#f59e0b" : "rgba(245,158,11,0.1)",
            color: userVote === "up" ? "#fff" : "#92400e",
            border: `1px solid ${userVote === "up" ? "#f59e0b" : "rgba(245,158,11,0.3)"}`,
            transform: animating === "up" ? "scale(0.93)" : "scale(1)",
            transition: "all 0.15s ease",
          }}
          aria-label="Upvote recipe"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          {userVote === "up" ? "Apreciat!" : "Apreciază"}
        </button>

        <button
          onClick={() => handleVote("down")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: userVote === "down" ? "#6b7280" : "rgba(107,114,128,0.08)",
            color: userVote === "down" ? "#fff" : "#6b7280",
            border: `1px solid ${userVote === "down" ? "#6b7280" : "rgba(107,114,128,0.2)"}`,
            transform: animating === "down" ? "scale(0.93)" : "scale(1)",
            transition: "all 0.15s ease",
          }}
          aria-label="Downvote recipe"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3z"/>
            <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
          </svg>
          {userVote === "down" ? "Neapreciat" : "Nu apreciez"}
        </button>
      </div>

      {/* Progress bar towards next star */}
      {stars < 5 && (
        <div>
          <div className="flex justify-between text-[10px] mb-1" style={{ color: "#aaa" }}>
            <span>★ {stars} stele</span>
            <span>Următoarele: ★ {stars + 1}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                background: "linear-gradient(to right, #f59e0b, #fbbf24)",
                width: `${getProgressToNextStar(votes)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function getProgressToNextStar(votes: number): number {
  const thresholds = [0, 1, 10, 30, 70, 150];
  const current = votesToStars(votes);
  if (current >= 5) return 100;
  const lo = thresholds[current];
  const hi = thresholds[current + 1];
  if (hi <= lo) return 100;
  return Math.min(100, Math.round(((votes - lo) / (hi - lo)) * 100));
}
