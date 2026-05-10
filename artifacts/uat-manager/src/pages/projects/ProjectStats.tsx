import { useParams, Link } from "wouter";
import { useGetProjectStats, getGetProjectStatsQueryKey } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Download, FileJson } from "lucide-react";
import { exportResultsToExcel } from "@/lib/export-utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = {
  passed: "hsl(142, 71%, 45%)", // green
  failed: "hsl(0, 84%, 60%)", // red
  pending: "hsl(215, 16%, 47%)", // gray
};

export default function ProjectStats() {
  const { projectId } = useParams();
  const id = parseInt(projectId || "0", 10);
  
  const { data: stats, isLoading } = useGetProjectStats(id, {
    query: { enabled: !!id, queryKey: getGetProjectStatsQueryKey(id) }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded"></div>)}
          </div>
          <div className="h-96 bg-muted/20 rounded"></div>
        </div>
      </AppLayout>
    );
  }

  if (!stats) {
    return (
      <AppLayout>
        <div className="text-center py-12">Stats not found</div>
      </AppLayout>
    );
  }

  const pieData = [
    { name: "Passed", value: stats.passed, color: COLORS.passed },
    { name: "Failed", value: stats.failed, color: COLORS.failed },
    { name: "Pending", value: stats.pending, color: COLORS.pending },
  ].filter(d => d.value > 0);

  const hasData = pieData.length > 0;

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
        title={`${stats.projectName} Analytics`}
        description="Execution statistics and test coverage breakdown."
        actions={
          <Button variant="outline" size="sm" onClick={() => exportResultsToExcel(stats)}>
            <Download className="w-4 h-4 mr-2" />
            Export Results (Excel)
          </Button>
        }
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExecutions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Passed / Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              {stats.passed} <span className="text-muted-foreground text-sm font-normal mx-1">/</span> <span className="text-destructive">{stats.failed}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">Pending Test Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Execution Status</CardTitle>
            <CardDescription>Overall breakdown of test statuses</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-sm">No executions recorded yet.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use Case Coverage</CardTitle>
            <CardDescription>Pass/fail distribution by use case</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {stats.useCaseBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.useCaseBreakdown}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="useCaseName" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                  <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: 'hsl(var(--muted))'}} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="passed" name="Passed" stackId="a" fill={COLORS.passed} radius={[0, 0, 4, 4]} />
                  <Bar dataKey="failed" name="Failed" stackId="a" fill={COLORS.failed} />
                  <Bar dataKey="pending" name="Pending" stackId="a" fill={COLORS.pending} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No use cases defined.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}