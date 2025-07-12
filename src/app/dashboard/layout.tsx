
"use client";

import Header from "@/components/header";
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from "@/components/ui/sidebar";
import { BarChart3, Library, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/icons/logo";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";


function NavContent() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
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
    <>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center gap-2">
           <Logo className="h-8 w-8 text-primary" />
           <h1 className="font-headline text-2xl tracking-tight">AdaptiLearn</h1>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard">
              <SidebarMenuButton tooltip="Library" isActive={pathname === '/dashboard'}>
                <Library />
                <span>My Library</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/dashboard/results">
               <SidebarMenuButton tooltip="My Progress" isActive={pathname === '/dashboard/results'}>
                <BarChart3 />
                <span>My Progress</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
         {user && (
            <div className="flex items-center gap-3 p-2 rounded-md bg-muted">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.photoURL || undefined} alt={user.name || "User"} data-ai-hint="person avatar"/>
                  <AvatarFallback>{user.name?.[0].toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium leading-none truncate">{user.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">
                        {user.email}
                    </p>
                </div>
                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push('/dashboard/settings')}>
                    <Settings className="h-4 w-4" />
                 </Button>
                 <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                 </Button>
            </div>
         )}
      </SidebarFooter>
    </>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full flex-col">
        <Header />
        <div className="flex flex-1">
           <Sidebar>
            <NavContent />
           </Sidebar>
          <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
