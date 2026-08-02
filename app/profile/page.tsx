import type { Metadata } from "next";
import { ProfileShell } from "@/components/profile/profile-shell";

export const metadata: Metadata = {
  title: "Formix | Profile",
  description: "Your Formix account, profile picture, and form creation activity.",
};

export default function ProfilePage() {
  return <ProfileShell />;
}
