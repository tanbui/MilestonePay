"use client";

import { usePathname } from "next/navigation";
import { NavList, type NavCounts } from "./NavList";

export function NavLinks({ counts }: { counts?: NavCounts }) {
  const pathname = usePathname();
  return <NavList counts={counts} pathname={pathname} />;
}
