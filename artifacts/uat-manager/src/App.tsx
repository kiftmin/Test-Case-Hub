import type { ComponentType } from "react";
import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, useParams } from "wouter";
// Reload trigger
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import ProjectsList from "@/pages/projects/ProjectsList";
import ProjectCreate from "@/pages/projects/ProjectCreate";
import ProjectEdit from "@/pages/projects/ProjectEdit";
import ProjectDetail from "@/pages/projects/ProjectDetail";
import ProjectStats from "@/pages/projects/ProjectStats";
import TesterLogin from "@/pages/tester/TesterLogin";
import TesterDashboard from "@/pages/tester/TesterDashboard";
import TesterScenarioSelector from "@/pages/tester/TesterScenarioSelector";
import TesterCaseSelector from "@/pages/tester/TesterCaseSelector";
import TesterStepWizard from "@/pages/tester/TesterStepWizard";
import ProjectUsers from "@/pages/projects/ProjectUsers";
import TestRunList from "@/pages/projects/TestRunList";
import TestRunDetail from "@/pages/projects/TestRunDetail";
import DefectLog from "@/pages/projects/DefectLog";
import BugList from "@/pages/projects/BugList";
import UserManagement from "@/pages/Users";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireTesterAuth } from "@/components/auth/RequireTesterAuth";
import { ConnectionBanner } from "@/components/tester/ConnectionBanner";
import { useGetProjectByCode } from "@workspace/api-client-react";
import { useGetTesterTestRuns } from "@workspace/api-client-react";
import { getAuthUser } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function AdminRoute({ component: Component }: { component: ComponentType }) {
  return (
    <RequireAuth loginPath="/tester">
      <Component />
    </RequireAuth>
  );
}

function AdminOnlyRoute({ component: Component }: { component: ComponentType }) {
  return (
    <RequireAuth loginPath="/" roles={["ADMIN"]}>
      <Component />
    </RequireAuth>
  );
}

function TesterRoute({ component: Component }: { component: ComponentType }) {
  return (
    <RequireTesterAuth>
      <Component />
    </RequireTesterAuth>
  );
}

function LegacyRedirect() {
  const { projectCode } = useParams();
  const code = (projectCode || "").toUpperCase();
  const user = getAuthUser();
  const [, setLocation] = useLocation();
  const { data: project } = useGetProjectByCode(code, {
    query: { enabled: !!code && !!user, queryKey: [`/api/projects/code/${code}`] },
  });
  const { data: testRuns } = useGetTesterTestRuns(user?.id ?? 0, {
    query: { enabled: !!user?.id, queryKey: [`/api/dashboard/tester/${user?.id}/test-runs`] },
  });

  useEffect(() => {
    if (project && testRuns) {
      const match = testRuns.find((r: any) => r.projectCode === code);
      if (match) {
        setLocation(`/tester/run/${match.id}`);
      }
    }
  }, [project, testRuns, code, setLocation]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-pulse text-sm text-muted-foreground">Redirecting...</div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <AdminRoute component={Dashboard} />}</Route>
      <Route path="/projects">{() => <AdminRoute component={ProjectsList} />}</Route>
      <Route path="/projects/new">{() => <AdminOnlyRoute component={ProjectCreate} />}</Route>
      <Route path="/projects/:projectId/edit">{() => <AdminOnlyRoute component={ProjectEdit} />}</Route>
      <Route path="/projects/:projectId/stats">{() => <AdminRoute component={ProjectStats} />}</Route>
      <Route path="/projects/:projectId/users">{() => <AdminRoute component={ProjectUsers} />}</Route>
      <Route path="/projects/:projectId/test-runs">{() => <AdminRoute component={TestRunList} />}</Route>
      <Route path="/projects/:projectId/test-runs/:testRunId">{() => <AdminRoute component={TestRunDetail} />}</Route>
      <Route path="/projects/:projectId/test-runs/:testRunId/defects">{() => <AdminRoute component={DefectLog} />}</Route>
      <Route path="/projects/:projectId/bugs">{() => <AdminRoute component={BugList} />}</Route>
      <Route path="/users">{() => <AdminOnlyRoute component={UserManagement} />}</Route>
      <Route path="/projects/:projectId">{() => <AdminRoute component={ProjectDetail} />}</Route>
      <Route path="/tester" component={TesterLogin} />
      <Route path="/tester/dashboard">{() => <TesterRoute component={TesterDashboard} />}</Route>
      <Route path="/tester/run/:testRunId/scenario/:scenarioId/case/:testCaseId">{() => <TesterRoute component={TesterStepWizard} />}</Route>
      <Route path="/tester/run/:testRunId/scenario/:scenarioId">{() => <TesterRoute component={TesterCaseSelector} />}</Route>
      <Route path="/tester/run/:testRunId">{() => <TesterRoute component={TesterScenarioSelector} />}</Route>
      <Route path="/tester/:projectCode">{() => <TesterRoute component={LegacyRedirect} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConnectionBanner />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;