"use client";

import Link from "next/link";
import { User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

/**
 * The shared signed-in account pill. Clicking it goes straight to the profile
 * page (/profile) — per the product decision, the avatar/icon is the door to
 * the author's profile, and sign-out lives on the profile page itself.
 */
export function ProfileMenu() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <Link
      href="/profile"
      aria-label={`Profile — signed in as ${user.email}`}
      className="flex h-8 items-center gap-1.5 rounded-full bg-(--accent-primary-tint) px-2 text-xs font-medium text-(--accent-primary) transition-colors hover:bg-(--accent-primary) hover:text-white"
    >
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar_url}
          alt=""
          className="h-5 w-5 rounded-full object-cover"
        />
      ) : (
        <UserIcon className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {user.name || user.email.split("@")[0]}
      </span>
    </Link>
  );
}
