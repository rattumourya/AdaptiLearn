
import Header from "@/components/header";
import { SidebarProvider, Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { BarChart3, Library } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavContent() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link href="/dashboard" legacyBehavior passHref>
              <SidebarMenuButton tooltip="Library" isActive={pathname === '/dashboard'}>
                <Library />
                <span>My Library</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Link href="/dashboard/results" legacyBehavior passHref>
               <SidebarMenuButton tooltip="My Progress" isActive={pathname === '/dashboard/results'}>
                <BarChart3 />
                <span>My Progress</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
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
