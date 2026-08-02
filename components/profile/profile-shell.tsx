"use client";

/**
 * components/profile/profile-shell.tsx
 * The author profile page: account card (avatar upload, editable name, email,
 * member-since, sign out) + stat chips + a GitHub-style heatmap of forms
 * created over the last year. Data: GET /profile; edits: PATCH /profile.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Camera,
  Mail,
  CalendarClock,
  FileText,
  Zap,
  Inbox,
  LogOut,
  Check,
  LayoutDashboard,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth-context";
import { getProfile, updateProfile, ApiError, type ProfileResponse } from "@/lib/api";

import { FormixLogo } from "@/components/brand/formix-logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { ProfileMenu } from "@/components/brand/profile-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContributionGrid } from "@/components/profile/contribution-grid";
import { FullPageLoader } from "@/components/ui/full-page-loader";

function describeError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}

/** Downscale an uploaded image to a small square-ish bitmap so the base64
 *  data URL stays far under the backend's 2MB cap — phone photos (2-6MB) get
 *  shrunk to ~256px JPEGs of a few KB instead of being rejected. */
async function resizeAvatarImage(file: File, maxSide = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("could not encode image"))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    bitmap.close();
  }
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function ProfileShell() {
  const router = useRouter();
  const { user, isLoading: authLoading, applyUser, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/signin");
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await getProfile();
      setProfile(data);
      setName(data.user.name ?? "");
    } catch (err) {
      setError(describeError(err));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  const saveName = useCallback(async () => {
    const trimmed = name.trim();
    if (!user || (trimmed === (user.name ?? ""))) return;
    setSavingName(true);
    try {
      const updated = await updateProfile({ name: trimmed });
      applyUser(updated);
      setProfile((prev) => (prev ? { ...prev, user: updated } : prev));
      toast.success("Name updated");
    } catch (err) {
      toast.error(`Couldn't update name — ${describeError(err)}`);
    } finally {
      setSavingName(false);
    }
  }, [name, user, applyUser]);

  const onFileSelected = useCallback(async (file: File | undefined) => {
    if (!file || !user) return;
    setUploading(true);
    try {
      // Resize first so camera photos never hit the 2MB backend cap.
      const resized = await resizeAvatarImage(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(resized);
      });
      const updated = await updateProfile({ avatar_url: dataUrl });
      applyUser(updated);
      setProfile((prev) => (prev ? { ...prev, user: updated } : prev));
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(`Couldn't update avatar — ${describeError(err)}`);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [user, applyUser]);

  if (authLoading || !user) {
    return <FullPageLoader label="Loading profile…" />;
  }

  const stats = [
    { label: "Total Forms", value: profile?.total_forms ?? 0, icon: <FileText className="h-4 w-4" /> },
    { label: "Published", value: profile?.published_forms ?? 0, icon: <Zap className="h-4 w-4" /> },
    { label: "Responses", value: profile?.total_submissions ?? 0, icon: <Inbox className="h-4 w-4" /> },
  ];

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-(--bg-base) text-(--ink-primary)">
      <header className="flex h-14 flex-none items-center justify-between border-b border-(--border-hairline) bg-(--bg-surface) px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex flex-none items-center gap-2 rounded-md px-1 py-1 transition-opacity hover:opacity-80">
            <FormixLogo size={20} variant="color" aria-hidden="true" />
            <span className="hidden text-sm font-semibold tracking-tight text-(--ink-primary) sm:inline">Formix</span>
          </Link>
          <ProfileMenu />
          <span className="h-4 w-px flex-none bg-(--border-hairline)" />
          <div className="flex items-center gap-1.5 rounded-md bg-(--accent-primary-tint) px-2 py-1.5 text-sm text-(--accent-primary)">
            <LayoutDashboard className="h-3.5 w-3.5" /> Profile
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/editor/demo">Open Editor</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div role="alert" className="mb-6 flex items-start gap-2.5 rounded-(--radius-md) border border-(--accent-danger)/30 bg-(--accent-danger)/5 px-3.5 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-(--accent-danger)" />
            <p className="text-sm text-(--accent-danger)">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ── Account card ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Avatar with upload overlay */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    aria-label="Upload profile picture"
                    className="group relative h-24 w-24 overflow-hidden rounded-full border border-(--border-hairline) bg-(--accent-primary-tint) text-(--accent-primary)"
                  >
                    {user.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl font-semibold">{initial}</span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                    </span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onFileSelected(e.target.files?.[0])}
                  />
                </div>

                {/* Editable name */}
                <div>
                  <label htmlFor="profile-name" className="mb-1 block text-xs uppercase tracking-[0.08em] text-(--ink-tertiary)">
                    Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveName()}
                      placeholder="Your name"
                      className="min-w-0 flex-1 rounded-(--radius-md) border border-(--border-hairline) bg-(--bg-surface) px-3 py-2 text-sm text-(--ink-primary) outline-none placeholder:text-(--ink-tertiary) focus:border-(--accent-primary)"
                    />
                    <Button
                      size="sm"
                      onClick={saveName}
                      disabled={savingName || name.trim() === (user.name ?? "")}
                      title="Save name"
                    >
                      {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Read-only account details */}
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 text-(--ink-secondary)">
                    <Mail className="h-3.5 w-3.5 flex-none text-(--ink-tertiary)" />
                    <span className="truncate">{user.email}</span>
                  </p>
                  <p className="flex items-center gap-2 text-(--ink-secondary)">
                    <CalendarClock className="h-3.5 w-3.5 flex-none text-(--ink-tertiary)" />
                    Member since {formatMemberSince(profile?.member_since ?? user.created_at)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout();
                    router.replace("/");
                  }}
                  className="w-full text-(--accent-danger)"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Stats + heatmap ─────────────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-3">
            <div className="grid grid-cols-3 gap-4">
              {stats.map((s) => (
                <Card key={s.label} className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-[0.08em] text-(--ink-tertiary)">{s.label}</span>
                    <span className="flex h-7 w-7 flex-none items-center justify-center text-(--ink-tertiary)">{s.icon}</span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold leading-none text-(--ink-primary)">
                    {profile ? s.value.toLocaleString() : <span className="inline-block h-6 w-12 animate-pulse rounded bg-(--bg-subtle)" />}
                  </p>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-(--ink-tertiary)" />
                  Form creation activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <ContributionGrid data={profile.forms_by_day} />
                ) : (
                  <div className="flex items-center gap-2 py-8 text-(--ink-secondary)">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading activity…</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
