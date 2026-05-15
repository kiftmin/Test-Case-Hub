import { Switch, Route, Router as WouterRouter } from "wouter";
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
import TestExecutionView from "@/pages/tester/TestExecutionView";
import ProjectUsers from "@/pages/projects/ProjectUsers";
import TestRunList from "@/pages/projects/TestRunList";
import TestRunDetail from "@/pages/projects/TestRunDetail";
import UserManagement from "@/pages/Users";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={ProjectsList} />
      <Route path="/projects/new" component={ProjectCreate} />
      <Route path="/projects/:projectId/edit" component={ProjectEdit} />
      <Route path="/projects/:projectId/stats" component={ProjectStats} />
      <Route path="/projects/:projectId/users" component={ProjectUsers} />
      <Route path="/projects/:projectId/test-runs" component={TestRunList} />
      <Route path="/projects/:projectId/test-runs/:testRunId" component={TestRunDetail} />
      <Route path="/users" component={UserManagement} />
      <Route path="/projects/:projectId" component={ProjectDetail} />
      <Route path="/tester" component={TesterLogin} />
      <Route path="/tester/dashboard" component={TesterDashboard} />
      <Route path="/tester/:projectCode" component={TestExecutionView} /> 
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;