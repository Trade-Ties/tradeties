"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { User } from "@workos-inc/node";
import { Building2, ChevronsUpDown, LayoutDashboard, LogOut } from "lucide-react";

import { signOutFromPortal } from "@/app/(pro)/dashboard/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { DASHBOARD_PATH, MARKETPLACE_PATH, PROFILE_PATH } from "@/lib/routes";

const NAV = [
  { label: "Dashboard", href: DASHBOARD_PATH, icon: LayoutDashboard },
  { label: "Business profile", href: PROFILE_PATH, icon: Building2 },
];

export function AppSidebar({ user }: { user: User }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-(--portal-header) justify-center overflow-hidden border-b border-sidebar-border px-4">
        <Link
          href={MARKETPLACE_PATH}
          className="truncate text-lg font-semibold tracking-tight transition-opacity duration-200 ease-linear group-data-[collapsible=icon]:opacity-0"
        >
          TradeTies
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-9.5">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  {/* Matched whole: `/dashboard` is a prefix of every other entry's path, so
                      `startsWith` would light it up on all of them. */}
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className="h-10 gap-3 text-base [&_svg]:size-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&&]:size-10! group-data-[collapsible=icon]:[&_svg]:size-6"
                    render={<Link href={item.href} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="group-data-[collapsible=icon]:[&&]:size-10! data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar size="lg" className="group-data-[collapsible=icon]:size-10!">
                  <AvatarImage src={user.profilePictureUrl ?? undefined} alt={displayName(user)} />
                  <AvatarFallback>{initials(user)}</AvatarFallback>
                </Avatar>

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName(user)}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>

                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>

              <DropdownMenuContent side="right" align="start" className="min-w-56 p-0">
                <form action={signOutFromPortal} className="w-full">
                  <DropdownMenuItem
                    closeOnClick={false}
                    nativeButton
                    className="h-10 w-full rounded-lg px-3"
                    render={<button type="submit" />}
                  >
                    <LogOut />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function displayName(user: User) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}

function initials(user: User) {
  const letters = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((part) => part!.charAt(0))
    .join("");

  return (letters || user.email.charAt(0)).toUpperCase();
}
