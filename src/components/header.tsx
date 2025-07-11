// src/components/header.tsx
"use client";

import Link from "next/link";
import { LogOut, Settings, User, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/icons/logo";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";

export default function Header() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed out successfully." });
      router.push('/');
    } catch (error) {
      toast({ title: "Failed to sign out.", variant: "destructive" });
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-lg font-semibold text-foreground md:text-base"
      >
        <Logo className="h-7 w-7 text-primary" />
        <h1 className="font-headline text-2xl tracking-tight">AdaptiLearn</h1>
      </Link>
      <div className="ml-auto flex items-center gap-4">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.photoURL || undefined} alt={user.name || "User"} data-ai-hint="person avatar"/>
                  <AvatarFallback>{user.name?.[0].toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigateTo('/dashboard/settings')}>
                <Settings className="mr-2" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleLogout}>
                <LogOut className="mr-2" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
            <Button onClick={() => navigateTo('/')}>Sign In</Button>
        )}
      </div>
    </header>
  );
}
