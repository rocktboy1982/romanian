"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Upload } from "lucide-react";
import { RecipeIngredient, RecipeInstruction } from "@/types/submission";

export default function RecipeSubmissionClient() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { name: "", quantity: 0, unit: "" },
  ]);
  const [instructions, setInstructions] = useState<RecipeInstruction[]>([
    { step: 1, instruction: "" },
  ]);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(30);
  const [servings, setServings] = useState(4);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: "", quantity: 0, unit: "" }]);
  };

  const handleRemoveIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const handleUpdateIngredient = (idx: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...ingredients];
    if (field === 'quantity') {
      updated[idx][field] = parseFloat(value) || 0;
    } else {
      updated[idx][field] = value;
    }
    setIngredients(updated);
  };

  const handleAddInstruction = () => {
    setInstructions([...instructions, { step: instructions.length + 1, instruction: "" }]);
  };

  const handleRemoveInstruction = (idx: number) => {
    const updated = instructions.filter((_, i) => i !== idx);
    updated.forEach((inst, i) => {
      inst.step = i + 1;
    });
    setInstructions(updated);
  };

  const handleUpdateInstruction = (idx: number, value: string) => {
    const updated = [...instructions];
    updated[idx].instruction = value;
    setInstructions(updated);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrors({});

    try {
      const payload = {
        title,
        description,
        ingredients,
        instructions,
        prepTime,
        cookTime,
        servings,
        difficulty,
        tags,
        cuisine: cuisine || undefined,
        coverImage: imageUrl || undefined,
      };

      const response = await fetch("/api/submit/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        }
        setMessage(data.message || "Failed to submit recipe");
      } else {
        setMessage("✅ Recipe submitted successfully! It's now pending admin approval.");
        // Reset form
        setTitle("");
        setDescription("");
        setIngredients([{ name: "", quantity: 0, unit: "" }]);
        setInstructions([{ step: 1, instruction: "" }]);
        setPrepTime(15);
        setCookTime(30);
        setServings(4);
        setDifficulty("medium");
        setTags([]);
        setCuisine("");
        setImageUrl("");
      }
    } catch (error) {
      console.error("Submission error:", error);
      setMessage("Error submitting recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
       <div>
         <h1 className="text-3xl font-bold mb-2">Trimite o rețetă</h1>
         <p className="text-gray-600">Distribuie rețeta ta preferată cu comunitatea noastră. Toate trimiterea sunt revizuite înainte de publicare.</p>
       </div>

         {message && (
         <div className={`p-4 rounded ${message.startsWith("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
           {message.replace("✅ Recipe submitted successfully! It's now pending admin approval.", "✅ Rețeta a fost trimisă cu succes! Așteptă aprobarea administratorului.")}
         </div>
       )}

      <form onSubmit={handleSubmit} className="space-y-6">
         {/* Title */}
         <Card>
           <CardHeader>
             <CardTitle>Informații de bază</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div>
               <label className="block font-medium mb-2">Titlu rețetă *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                 placeholder="ex. Pasta Carbonara clasică"
                className={errors.title ? "border-red-500" : ""}
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>

             <div>
               <label className="block font-medium mb-2">Descriere *</label>
               <textarea
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 placeholder="Descrie rețeta ta..."
                rows={4}
                className={`w-full border rounded p-2 ${errors.description ? "border-red-500" : ""}`}
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
            </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block font-medium mb-2">Timp de pregătire (minute) *</label>
                <Input
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
                  min="0"
                  max="480"
                />
              </div>
               <div>
                 <label className="block font-medium mb-2">Timp de gătire (minute) *</label>
                <Input
                  type="number"
                  value={cookTime}
                  onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
                  min="0"
                  max="480"
                />
              </div>
            </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block font-medium mb-2">Porții *</label>
                <Input
                  type="number"
                  value={servings}
                  onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                  min="1"
                  max="100"
                />
              </div>
               <div>
                 <label className="block font-medium mb-2">Dificultate *</label>
                 <select
                   value={difficulty}
                   onChange={(e) => setDifficulty(e.target.value as any)}
                   className="w-full border rounded p-2"
                 >
                   <option value="easy">Ușor</option>
                   <option value="medium">Mediu</option>
                   <option value="hard">Greu</option>
                 </select>
               </div>
            </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                 <label className="block font-medium mb-2">Bucătărie</label>
                 <Input
                   value={cuisine}
                   onChange={(e) => setCuisine(e.target.value)}
                   placeholder="ex. Italiană"
                 />
               </div>
               <div>
                 <label className="block font-medium mb-2">URL imagine de copertă</label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
          </CardContent>
        </Card>

         {/* Ingredients */}
         <Card>
           <CardHeader className="flex justify-between items-center">
             <CardTitle>Ingrediente *</CardTitle>
             <Button type="button" size="sm" onClick={handleAddIngredient} variant="outline">
               <Plus className="w-4 h-4 mr-1" /> Adaugă
             </Button>
           </CardHeader>
          <CardContent className="space-y-3">
            {ingredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 items-end">
                <div className="flex-1">
                   <Input
                     value={ing.name}
                     onChange={(e) => handleUpdateIngredient(idx, "name", e.target.value)}
                     placeholder="Nume ingredient"
                   />
                </div>
                <div className="w-20">
                  <Input
                    type="number"
                    value={ing.quantity}
                    onChange={(e) => handleUpdateIngredient(idx, "quantity", e.target.value)}
                    placeholder="Qty"
                    step="0.1"
                  />
                </div>
                <div className="w-20">
                  <Input
                    value={ing.unit}
                    onChange={(e) => handleUpdateIngredient(idx, "unit", e.target.value)}
                    placeholder="Unit"
                  />
                </div>
                {ingredients.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveIngredient(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {errors.ingredients && <p className="text-red-500 text-sm">{errors.ingredients}</p>}
          </CardContent>
        </Card>

         {/* Instructions */}
         <Card>
           <CardHeader className="flex justify-between items-center">
             <CardTitle>Instrucțiuni *</CardTitle>
             <Button type="button" size="sm" onClick={handleAddInstruction} variant="outline">
               <Plus className="w-4 h-4 mr-1" /> Adaugă pas
             </Button>
           </CardHeader>
          <CardContent className="space-y-3">
            {instructions.map((inst, idx) => (
              <div key={idx} className="flex gap-2">
                <div className="w-8 pt-2 text-center font-semibold text-gray-500">{inst.step}</div>
                <div className="flex-1">
                  <textarea
                    value={inst.instruction}
                    onChange={(e) => handleUpdateInstruction(idx, e.target.value)}
                    placeholder={`Step ${inst.step}...`}
                    rows={2}
                    className="w-full border rounded p-2"
                  />
                </div>
                {instructions.length > 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveInstruction(idx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {errors.instructions && <p className="text-red-500 text-sm">{errors.instructions}</p>}
          </CardContent>
        </Card>

         {/* Tags */}
         <Card>
           <CardHeader>
             <CardTitle>Etichete *</CardTitle>
           </CardHeader>
           <CardContent className="space-y-3">
             <div className="flex gap-2">
               <Input
                 value={newTag}
                 onChange={(e) => setNewTag(e.target.value)}
                 placeholder="ex. vegan, rapid, cină"
                 onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
               />
               <Button type="button" onClick={handleAddTag} variant="outline">
                 <Plus className="w-4 h-4" />
               </Button>
             </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <div key={tag} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {errors.tags && <p className="text-red-500 text-sm">{errors.tags}</p>}
          </CardContent>
        </Card>

         {/* Submit */}
         <div className="flex gap-2">
           <Button type="submit" disabled={loading} className="px-6">
             {loading ? "Se trimite..." : "Trimite rețeta"}
           </Button>
           <Button type="button" variant="outline" onClick={() => window.history.back()}>
             Anulează
           </Button>
         </div>
      </form>
    </div>
  );
}
