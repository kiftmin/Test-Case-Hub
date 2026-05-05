import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PlaySquare } from "lucide-react";
import { useGetProjectByCode } from "@workspace/api-client-react";

export default function TesterLogin() {
  const [, setLocation] = useLocation();
  const [projectCode, setProjectCode] = useState("");
  const [testerName, setTesterName] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // We only fetch when they hit submit
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim() || !testerName.trim()) {
      setError("Both project code and your name are required.");
      return;
    }

    setIsVerifying(true);
    try {
      // In a real app we'd query directly, but here we can just use the route change
      // and let TestExecutionView handle the project loading, or fetch here first.
      const res = await fetch(`/api/projects/code/${projectCode}`);
      if (res.ok) {
        // Project exists
        // Store tester name in session storage
        sessionStorage.setItem("testerName", testerName);
        setLocation(`/tester/${projectCode}`);
      } else {
        setError("Invalid project code. Please check with your QA lead.");
      }
    } catch (err) {
      setError("Failed to verify project. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8 text-primary">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <PlaySquare className="w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">TestFlow Portal</span>
        </div>

        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-xl">Tester Access</CardTitle>
            <CardDescription>
              Enter your project code to begin test execution.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md font-medium">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="projectCode">Project Code</Label>
                <Input
                  id="projectCode"
                  placeholder="e.g. PRJ-123"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="testerName">Your Name</Label>
                <Input
                  id="testerName"
                  placeholder="e.g. John Doe"
                  value={testerName}
                  onChange={(e) => setTesterName(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button type="submit" className="w-full" disabled={isVerifying}>
                {isVerifying ? "Verifying..." : "Access Test Plan"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Are you a QA Lead? <a href="/" className="text-primary hover:underline">Go to Admin Dashboard</a>
          </p>
        </div>
      </div>
    </div>
  );
}