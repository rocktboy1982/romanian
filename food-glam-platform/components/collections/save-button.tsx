"use client"

import React, { useState } from "react"

type SaveButtonProps = {
  postId: string
  isSaved?: boolean
  onToggle?: (saved: boolean) => void
  size?: "sm" | "md"
}

export default function SaveButton({ postId, isSaved = false, onToggle, size = "md" }: SaveButtonProps) {
  const [saved, setSaved] = useState(isSaved)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    setLoading(true)
    try {
      if (saved) {
        const res = await fetch("/api/collection-items", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        })
        if (res.ok) {
          setSaved(false)
          onToggle?.(false)
        }
      } else {
        const res = await fetch("/api/collection-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        })
        if (res.ok || res.status === 409) {
          setSaved(true)
          onToggle?.(true)
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const sizeClasses = size === "sm" ? "w-8 h-8 text-base" : "w-10 h-10 text-lg"

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Desalvează" : "Salvează"}
       title={saved ? "Elimina din carte de rețete" : "Salvează în carte de rețete"}
      className={`${sizeClasses} flex items-center justify-center rounded-full transition-all duration-200 ${
        saved
          ? "bg-red-50 text-red-500 hover:bg-red-100 shadow-sm"
          : "bg-white/80 text-gray-400 hover:text-red-400 hover:bg-white shadow-sm backdrop-blur-sm"
      } ${loading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
    >
      {saved ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      )}
    </button>
  )
}
