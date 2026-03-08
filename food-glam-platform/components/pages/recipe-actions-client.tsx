"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePreferredRecipes } from '@/lib/preferred-recipes';
import ReportButton from '@/components/ReportButton';
import DeleteContentButton from '@/components/DeleteContentButton';
import { useRouter } from 'next/navigation';

interface ExportData {
  servings?: number;
  total_time?: string;
  prep_time?: string;
  cook_time?: string;
  ingredients?: string[];
  steps?: string[];
  nutrition?: { calories: number; protein: number; carbs: number; fat: number };
  region?: string;
  dietTags?: string[];
  creator?: string;
}

interface RecipeActionsClientProps {
  recipeId: string;
  slug: string;
  title: string;
  exportData?: ExportData;
  isOwner?: boolean;
}

export default function RecipeActionsClient({ recipeId, slug, title, exportData, isOwner = false }: RecipeActionsClientProps) {
  const [saved, setSaved] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { addRecipe, removeRecipe, preferredIds } = usePreferredRecipes();
  const router = useRouter();

  useEffect(() => {
    setSaved(preferredIds.has(recipeId));
  }, [preferredIds, recipeId]);

  const handleSave = async () => {
    try {
      if (saved) {
        removeRecipe(recipeId);
      } else {
        addRecipe({ id: recipeId, slug, title }, "manual");
      }

      // Also try API call for cookbook
      const res = await fetch('/api/collection-items', {
        method: saved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: recipeId })
      });

      if (!res.ok && res.status !== 401) {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/recipes/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user cancelled
      }
    } else {
      setShareOpen(!shareOpen);
      setExportOpen(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/recipes/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownloadTxt = () => {
    const lines: string[] = [];
    lines.push(`${title}`);
    lines.push('='.repeat(title.length));
    lines.push('');

    if (exportData?.region) lines.push(`Region: ${exportData.region}`);
    if (exportData?.creator) lines.push(`By: ${exportData.creator}`);
    if (exportData?.servings) lines.push(`Servings: ${exportData.servings}`);
    if (exportData?.total_time) lines.push(`Total time: ${exportData.total_time}`);
    if (exportData?.prep_time) lines.push(`Prep: ${exportData.prep_time}`);
    if (exportData?.cook_time) lines.push(`Cook: ${exportData.cook_time}`);
    if (exportData?.dietTags?.length) lines.push(`Diet: ${exportData.dietTags.join(', ')}`);
    lines.push('');

    if (exportData?.ingredients?.length) {
      lines.push('INGREDIENTS');
      lines.push('-----------');
      exportData.ingredients.forEach(ing => lines.push(`• ${ing}`));
      lines.push('');
    }

    if (exportData?.steps?.length) {
      lines.push('DIRECTIONS');
      lines.push('----------');
      exportData.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push('');
    }

    if (exportData?.nutrition) {
      lines.push('NUTRITION (per serving)');
      lines.push('-----------------------');
      lines.push(`Calories: ${exportData.nutrition.calories} kcal`);
      lines.push(`Protein: ${exportData.nutrition.protein}g`);
      lines.push(`Carbs: ${exportData.nutrition.carbs}g`);
      lines.push(`Fat: ${exportData.nutrition.fat}g`);
      lines.push('');
    }

    lines.push(`Source: ${window.location.origin}/recipes/${slug}`);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleDownloadJson = () => {
    const data = {
      title,
      slug,
      url: `${window.location.origin}/recipes/${slug}`,
      ...exportData,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="space-y-3">
      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        <Link href={`/recipes/${slug}/cook`} className="flex-1 min-w-[140px]">
           <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/>
               <path d="M10 8l6 4-6 4V8z" fill="currentColor"/>
             </svg>
             Mod gătit
           </Button>
        </Link>

        <Button
          variant={saved ? "default" : "outline"}
          className={`flex-1 min-w-[140px] gap-2 ${saved ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : ""}`}
          onClick={handleSave}
        >
           {saved ? (
             <span className="text-base">⭐</span>
           ) : (
             <span className="text-base">☆</span>
           )}
           {saved ? "Preferat" : "Salvează"}
         </Button>
       </div>

       {/* Secondary actions */}
       <div className="flex flex-wrap gap-2">
         <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
             <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
           </svg>
           Distribuie
         </Button>

         <Link href={`/recipes/${slug}/print`} target="_blank">
           <Button variant="outline" size="sm" className="gap-1.5">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
               <rect x="6" y="14" width="12" height="8"/>
             </svg>
             Printează
           </Button>
         </Link>

         <Button
           variant="outline"
           size="sm"
           className="gap-1.5"
           onClick={() => { setExportOpen(!exportOpen); setShareOpen(false); }}
         >
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
             <polyline points="7 10 12 15 17 10"/>
             <line x1="12" y1="15" x2="12" y2="3"/>
           </svg>
           Exportă
         </Button>
        </div>

         <div className="flex flex-wrap gap-2 items-center justify-between">
           <ReportButton contentId={recipeId} contentType="recipe" contentTitle={title} variant="full" />
           {isOwner && (
             <DeleteContentButton
               postId={recipeId}
               postTitle={title}
               onDeleted={() => router.push('/')}
               variant="button"
               size="sm"
             />
           )}
         </div>

       {/* Export dropdown */}
       {exportOpen && (
         <div className="p-3 bg-muted rounded-lg space-y-2">
           <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Exportă rețeta ca</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleDownloadTxt}
              className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm hover:bg-background transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
               <span>Text simplu (.txt)</span>
               <span className="ml-auto text-xs text-muted-foreground">Ingrediente + pași</span>
             </button>
             <button
               onClick={handleDownloadJson}
               className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm hover:bg-background transition-colors"
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                 <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
               </svg>
               <span>JSON (.json)</span>
               <span className="ml-auto text-xs text-muted-foreground">Citibil de mașină</span>
             </button>
             <Link
               href={`/recipes/${slug}/print`}
               target="_blank"
               className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-md text-sm hover:bg-background transition-colors"
               onClick={() => setExportOpen(false)}
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                 <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                 <rect x="6" y="14" width="12" height="8"/>
               </svg>
               <span>Salvează ca PDF</span>
               <span className="ml-auto text-xs text-muted-foreground">Via dialog de imprimare</span>
             </Link>
           </div>
         </div>
       )}

       {/* Share dropdown */}
       {shareOpen && (
         <div className="p-3 bg-muted rounded-lg space-y-2">
           <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Distribuie această rețetă</p>
           <div className="flex gap-2">
             <input
               readOnly
               value={typeof window !== "undefined" ? `${window.location.origin}/recipes/${slug}` : `/recipes/${slug}`}
               className="flex-1 text-xs bg-background border rounded px-2 py-1.5"
             />
             <Button size="sm" variant="outline" onClick={handleCopyLink}>
               {copyFeedback ? "Copiat!" : "Copiază"}
             </Button>
           </div>
         </div>
       )}
    </div>
  );
}
