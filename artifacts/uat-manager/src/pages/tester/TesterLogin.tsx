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
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Username and password are required.");
      return;
    }

    setIsVerifying(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        const { token, user } = data;
        
        // Use our new auth utility
        import("@/lib/auth").then(({ setAuth }) => {
          setAuth(token, user);
          
          if (user.role === "TESTER") {
            setLocation("/tester/dashboard");
          } else {
            setLocation("/");
          }
        });
      } else {
        const errData = await res.json();
        setError(errData.error || "Invalid credentials.");
      }
    } catch (err) {
      setError("Login failed. Please check your connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

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
            <CardTitle className="text-xl text-center">System Login</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your test dashboard.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm bg-destructive/10 text-destructive rounded-md font-medium text-center border border-destructive/20">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-muted/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button type="submit" className="w-full h-11" disabled={isVerifying}>
                {isVerifying ? "Logging in..." : "Sign In"}
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