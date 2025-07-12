
// src/components/header.tsx
"use client";

import { SidebarTrigger } from "./ui/sidebar";

export default function Header() {
  
  return (
    <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6 z-20">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden"/>
      </div>
    </header>
  );
}
