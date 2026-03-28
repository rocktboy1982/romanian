"use client";

import React from "react";
import Link from "next/link";

const contentTypes = [
  {
    type: "recipe",
    label: "Rețetă",
    description: "Publică o rețetă completă cu ingrediente, pași și fotografii",
    href: "/submit/recipe",
    icon: "🍽️",
    accent: "from-amber-500/20 to-orange-500/20",
    border: "hover:border-amber-400/60",
  },
  {
    type: "cocktail",
    label: "Băutură / Cocktail",
    description: "Adaugă un cocktail sau o băutură cu ingrediente și mod de preparare",
    href: "/submit/cocktail",
    icon: "🍹",
    accent: "from-rose-500/20 to-pink-500/20",
    border: "hover:border-rose-400/60",
  },
  {
    type: "import",
    label: "Importă rețetă (URL)",
    description: "Importă o rețetă de pe un alt site — necesită statut de creator certificat",
    href: "/submit/import",
    icon: "🔗",
    accent: "from-violet-500/20 to-purple-500/20",
    border: "hover:border-violet-400/60",
  },
];

export default function SubmitClient() {
  return (
    <main className="min-h-screen container mx-auto px-4 py-12 max-w-3xl" style={{ background: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Creează ceva</h1>
        <p className="text-muted-foreground">Alege ce vrei să împărtășești cu comunitatea.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {contentTypes.map((ct) => (
          <Link
            key={ct.type}
            href={ct.href}
            className={`group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-gradient-to-br ${ct.accent} p-6 transition-all duration-200 ${ct.border} hover:shadow-lg hover:-translate-y-0.5`}
          >
            <div className="text-3xl transition-transform duration-200 group-hover:scale-110">
              {ct.icon}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{ct.label}</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{ct.description}</p>
            </div>
            <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link href="/me/posts" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
          Vezi postările tale
        </Link>
      </div>
    </main>
  );
}
