import { Link } from "wouter";
import { useGetDashboardSummary, useGetRecentActivity, useListUsers } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, FolderKanban, ListTodo, Users } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: recentActivity, isLoading: isActivityLoading } = useGetRecentActivity();
  const { data: users } = useListUsers();

  return (
    <AppLayout>
      <PageHeader 
        title="Dashboard" 
        description="Overview of your testing operations and recent activity."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalProjects || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Active test projects
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Test Cases</CardTitle>
            <ListTodo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalTestCases || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">{users?.length || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Registered system users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isSummaryLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              <div className="text-2xl font-bold">
                {summary?.passRate ? `${summary.passRate.toFixed(1)}%` : '0%'}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Global passing average
            </p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-bold tracking-tight mb-4">Recent Executions</h2>
      <Card>
        <div className="divide-y divide-border">
          {isActivityLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading activity...</div>
          ) : !recentActivity || recentActivity.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No recent activity found.</div>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.executionId} className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${activity.passed === true ? 'bg-green-500' : activity.passed === false ? 'bg-destructive' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="font-medium text-sm">
                      {activity.testCaseName}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{activity.projectName}</span>
                      <span>&bull;</span>
                      <span>Executed by {activity.testerName}</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(activity.executedAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </AppLayout>
  );
}