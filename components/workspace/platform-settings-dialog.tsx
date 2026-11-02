"use client";

import { useEffect, useState } from "react";
import { Link2, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addProjectMember, createWebhook, deleteWebhook, getProjectMembers, getWebhookDeliveries, getWebhooks,
  removeProjectMember, replayWebhookDelivery, updateProjectMember, type ProjectMember, type WebhookDelivery, type WebhookEndpoint,
} from "@/lib/api";


export function PlatformSettingsDialog({ projectId, formId, open, onOpenChange }: {
  projectId: string | null;
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (projectId) void getProjectMembers(projectId).then(setMembers).catch((e) => toast.error(e.message));
    if (formId) {
      void getWebhooks(formId).then(setWebhooks).catch((e) => toast.error(e.message));
      void getWebhookDeliveries(formId).then(setDeliveries).catch((e) => toast.error(e.message));
    }
  }, [formId, open, projectId]);

  const invite = async () => {
    if (!projectId || !email.trim()) return;
    setBusy(true);
    try {
      await addProjectMember(projectId, email.trim(), role);
      setMembers(await getProjectMembers(projectId));
      setEmail("");
      toast.success("Collaborator added");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add collaborator"); }
    finally { setBusy(false); }
  };

  const addWebhook = async () => {
    if (!formId || !url.trim()) return;
    setBusy(true);
    try {
      const created = await createWebhook(formId, url.trim());
      setWebhooks(await getWebhooks(formId));
      setUrl("");
      await navigator.clipboard.writeText(created.secret ?? "");
      toast.success("Webhook added. Its signing secret was copied to your clipboard.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not add webhook"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Project settings</DialogTitle>
          <DialogDescription>Collaborators share the project. Webhooks belong to the selected form.</DialogDescription>
        </DialogHeader>

        <section className="space-y-3">
          <div className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /><h3 className="text-sm font-semibold">Team</h3></div>
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" type="email" />
            <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="rounded-md border border-border bg-background px-3 text-sm">
              <option value="viewer">Viewer</option><option value="editor">Editor</option>
            </select>
            <Button onClick={invite} disabled={busy || !projectId}><UserPlus className="h-4 w-4" /> Add</Button>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0"><p className="truncate font-medium">{member.name || member.email}</p><p className="truncate text-xs text-muted-foreground">{member.email}</p></div>
                <div className="flex items-center gap-2">{member.role === "owner" ? <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">owner</span> : <select aria-label={`Role for ${member.email}`} value={member.role} onChange={async (event) => { if (!projectId) return; await updateProjectMember(projectId, member.id, event.target.value as "editor" | "viewer"); setMembers(await getProjectMembers(projectId)); }} className="rounded-md border border-border bg-background px-2 py-1 text-xs"><option value="viewer">Viewer</option><option value="editor">Editor</option></select>}{member.role !== "owner" && <button aria-label={`Remove ${member.email}`} onClick={async () => { if (!projectId) return; await removeProjectMember(projectId, member.id); setMembers(await getProjectMembers(projectId)); }}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>}</div>
              </div>
            ))}
          </div>
          {deliveries.length > 0 && <div className="space-y-2 pt-2"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent deliveries</p><div className="divide-y divide-border rounded-lg border border-border">{deliveries.slice(0, 5).map((delivery) => <div key={delivery.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs"><span className="font-mono text-muted-foreground">{delivery.id.slice(0, 8)}</span><span className={delivery.status === "delivered" ? "text-success" : delivery.status === "failed" ? "text-destructive" : "text-muted-foreground"}>{delivery.status} · {delivery.attempt_count} attempt{delivery.attempt_count === 1 ? "" : "s"}</span>{delivery.status === "failed" && <button className="font-medium text-accent" onClick={async () => { if (!formId) return; await replayWebhookDelivery(formId, delivery.id); setDeliveries(await getWebhookDeliveries(formId)); }}>Replay</button>}</div>)}</div></div>}
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-accent" /><h3 className="text-sm font-semibold">Signed webhooks</h3></div>
          <div className="flex gap-2"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/formix" type="url" /><Button onClick={addWebhook} disabled={busy || !formId}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Add</Button></div>
          <p className="text-xs text-muted-foreground">Secrets are shown once and signatures use the X-Formix-Signature header.</p>
          <div className="divide-y divide-border rounded-lg border border-border">
            {webhooks.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">No webhooks configured.</p>}
            {webhooks.map((webhook) => <div key={webhook.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0 truncate font-mono text-xs">{webhook.url}</span><button aria-label="Delete webhook" onClick={async () => { if (!formId) return; await deleteWebhook(formId, webhook.id); setWebhooks(await getWebhooks(formId)); }}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button></div>)}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
