"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type Hit = {
  id: string;
  slug?: string | null;
  title?: string | null;
  summary?: string | null;
  recipe_json?: Record<string, unknown> | null;
  hero_image_url?: string | null;
  rank?: number | null;
};

export default function SimilarRecipesClient({ id }: { id: string }) {
  const [items, setItems] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/recipes/${id}/similar`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (!mounted) return;
        setItems(json.results || []);
      } catch (e) {
        console.error('similar fetch', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, [id]);

  if (loading) return <div>Loading similar recipes...</div>;
  if (!items.length) return <div className="text-sm text-muted-foreground">No similar recipes found yet.</div>;

  return (
    <div className="space-y-2">
      {items.slice(0,6).map(it => {
        const rj = it.recipe_json || {};
        const img = it.hero_image_url || (rj as Record<string, unknown>).hero_image_url as string | null || (rj as Record<string, unknown>).image as string | null || null;
        const ingredients = ((rj as Record<string, unknown>).recipeIngredient || (rj as Record<string, unknown>).ingredients || []) as string[];
        const excerpt = it.summary || (rj as Record<string, unknown>).description as string || (ingredients.length > 0 ? ingredients.slice(0,3).join(', ') : '');
        const rank = typeof it.rank === 'number' ? it.rank : null;
        const href = it.slug ? `/recipes/${it.slug}` : `/recipes/${it.id}`;
        return (
          <Card key={it.id}>
            <CardContent className="p-3 flex gap-3 items-start">
              {img ? <img src={img} alt={it.title || 'thumb'} className="w-20 h-14 object-cover rounded" /> : <div className="w-20 h-14 bg-muted rounded" />}
              <div className="flex-1">
                <Link href={href} className="font-medium block">{it.title || 'Untitled'}</Link>
                {excerpt && <div className="text-sm text-muted-foreground line-clamp-2">{excerpt}</div>}
              </div>
              {rank != null && <div className="text-sm text-muted-foreground flex flex-col items-end"><span className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-semibold">{Math.round(rank * 100) / 100}</span><span className="text-xs text-muted-foreground mt-1">score</span></div>}
            </CardContent>
          </Card>
        )
      })}
    </div>
  );
}
