import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { login } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ScanLine, Zap } from "lucide-react";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { checkAuth } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email, password });
      await checkAuth();
      toast({ title: "Welcome back", description: "You're now signed in." });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Sign in failed",
        description: err.message || "Invalid email or password.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-md mx-auto gap-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
          <ScanLine className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Sign in to Lens</h1>
        <p className="text-muted-foreground">
          Unlock 25 daily scans — 5x the free limit
        </p>
      </div>

      <Card className="w-full border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Zap className="h-4 w-4" />
            <span>Registered users get 25 scans/day</span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 bg-background/50 focus-visible:ring-primary/50"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 bg-background/50 focus-visible:ring-primary/50"
                data-testid="input-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-semibold text-base shadow-[0_0_20px_rgba(34,211,238,0.2)]"
              disabled={isLoading || !email || !password}
              data-testid="button-login"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="text-primary font-medium hover:underline" data-testid="link-register">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
