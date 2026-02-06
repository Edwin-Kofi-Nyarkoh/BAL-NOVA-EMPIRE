// components/customer/GenieFab.tsx
"use client"
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GenieFab() {
  return (
    <Button 
      className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl bg-myamber text-mynavy hover:bg-myamber/90 border-4 border-white dark:border-mynavy animate-bounce"
      onClick={() => alert("Empire Genie logic triggered!")}
    >
      <Sparkles size={24} fill="currentColor" />
    </Button>
  );
}