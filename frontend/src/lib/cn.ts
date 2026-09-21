/**
 * cn.ts — Class name utility combining clsx and tailwind-merge.
 *
 * Usage: cn("px-4 py-2", isActive && "bg-accent", className)
 */
import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
