import { useState } from "react";
import { Link, useParams } from "wouter";
import { getAuthUser, getAuthToken } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Plus,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useGetProject, getGetProjectQueryKey, useListProjectUsers, getListProjectUsersQueryKey } from "@workspace/api-client-react";

const API_BASE = "/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestRun {
  id: number;
  projectId: number;
  name: string;
  status: "scheduled" | "in_progress" | "completed";
  scheduledAt: string;
  passed: boolean | null;
  sourceTestRunId: number | null;
  createdAt: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ run }: { run: TestRun }) {
  if (run.status === "completed") {
    return run.passed ? (
      <Badge className="bg-green-500/15 text-green-600 border-green-500/30 hover:bg-green-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Passed
      </Badge>
    ) : (
      <Badge className="bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/20">
        <XCircle className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  }
  if (run.status === "in_progress") {
    return (
      <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> In Progress
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/20">
      <Clock className="w-3 h-3 mr-1" /> Scheduled
    </Badge>
  );
}

// ─── Create Dialog ────────────────────────────────────────────────────────────

function CreateTestRunDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/projects/${projectId}/test-runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ name, scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-runs", projectId] });
      toast({ title: "Test run created" });
      setName("");
      setScheduledAt("");
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Default to 1 hour from now for UX convenience
  const defaultDateTime = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Test Run</DialogTitle>
          <DialogDescription>
            Schedule a test run. It will include all use cases by default.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tr-name">Name</Label>
            <Input
              id="tr-name"
              placeholder="e.g. Sprint 14 Regression"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-sched">Scheduled Date &amp; Time</Label>
            <Input
              id="tr-sched"
              type="datetime-local"
              defaultValue={defaultDateTime()}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name.trim() || !scheduledAt || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestRunList() {
  const { projectId } = useParams();
  const user = getAuthUser();
  const id = parseInt(projectId || "0", 10);
  const [showCreate, setShowCreate] = useState(false);

  const { data: project } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) }
  });
  const { data: assignments = [] } = useListProjectUsers(id, {
    query: { enabled: !!id, queryKey: getListProjectUsersQueryKey(id) }
  });
  const isSignedOff = (project as any)?.isSignedOff === 1;
  const projectRole = assignments.find((a: any) => a.userId === user?.id)?.role;
  const canCreateRun = user?.role === "ADMIN" || projectRole === "TEST_LEAD";

  const { data: runs = [], isLoading } = useQuery<TestRun[]>({
    queryKey: ["test-runs", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/projects/${id}/test-runs`, {
        headers: { "Authorization": `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!id,
    refetchInterval: 15_000,
  });

  const scheduled = runs.filter((r) => r.status === "scheduled");
  const inProgress = runs.filter((r) => r.status === "in_progress");
  const completed = runs.filter((r) => r.status === "completed");

  const renderCard = (run: TestRun) => (
    <Link key={run.id} href={`/projects/${id}/test-runs/${run.id}`}>
      <Card className="group hover:border-primary/50 transition-all cursor-pointer hover:shadow-md border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base group-hover:text-primary transition-colors leading-snug">
              {run.name}
            </CardTitle>
            <StatusBadge run={run} />
          </div>
          {run.sourceTestRunId && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Re-run from test run #{run.sourceTestRunId}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-4 h-4 shrink-0" />
              <span>
                {format(new Date(run.scheduledAt), "d MMM yyyy, HH:mm")}
                {run.status === "scheduled" && (
                  <span className="ml-1 text-amber-600">
                    ({formatDistanceToNow(new Date(run.scheduledAt), { addSuffix: true })})
                  </span>
                )}
              </span>
            </div>
            <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Project
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Test Runs"
        description="Schedule and manage test runs for this project."
        actions={
          canCreateRun && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Test Run
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse h-36 bg-muted/20" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <div className="mt-8 text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
          <CalendarClock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium">No test runs yet</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Create your first test run to get started.
          </p>
          {canCreateRun && (
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> New Test Run
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {inProgress.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                In Progress
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {inProgress.map(renderCard)}
              </div>
            </section>
          )}
          {scheduled.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Scheduled
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {scheduled.map(renderCard)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Completed
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completed.map(renderCard)}
              </div>
            </section>
          )}
        </div>
      )}

      <CreateTestRunDialog
        projectId={id}
        open={showCreate}
        onClose={() => setShowCreate(false)}
      />
    </AppLayout>
  );
}
