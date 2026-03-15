// components/customer/GenieFab.tsx
"use client"
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/dialog-service";

export function GenieFab() {
  const dialog = useDialog();
  return (
    <Button 
      className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl bg-myamber text-mynavy hover:bg-myamber/90 border-4 border-white dark:border-mynavy animate-bounce"
      onClick={() => {
        void dialog.alert("Empire Genie logic triggered!");
      }}
    >
      <Sparkles size={24} fill="currentColor" />
    </Button>
  );
}
