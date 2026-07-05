import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { register } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, ScanLine, Check, X, Zap } from "lucide-react";

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const RULES: PasswordRule[] = [
  { label: "12+ characters", test: (p) => p.length >= 12 },
  { label: "Uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "Number", test: (p) => /\d/.test(p) },
  { label: "Special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { checkAuth } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const passedRules = RULES.filter((r) => r.test(password));
  const allPassed = passedRules.length === RULES.length;
  const strength = passedRules.length / RULES.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allPassed) return;
    setIsLoading(true);
    try {
      await register({ email, password });
      await checkAuth();
      toast({ title: "Account created", description: "Welcome to Lens." });
      setLocation("/");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.message || "Could not create your account.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const strengthColor =
    strength < 0.4 ? "bg-red-500" : strength < 0.8 ? "bg-yellow-500" : "bg-primary";

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-md mx-auto gap-8">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
          <ScanLine className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground">
          Start scanning smarter with 25 daily scans
        </p>
      </div>

      <Card className="w-full border-border/50 bg-card/60 backdrop-blur-xl shadow-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Zap className="h-4 w-4" />
            <span>Free account — 25 scans/day vs. 5 as a guest</span>
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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setShowRules(true); }}
                onFocus={() => setShowRules(true)}
                required
                autoComplete="new-password"
                className="h-11 bg-background/50 focus-visible:ring-primary/50"
                data-testid="input-password"
              />
              {showRules && password.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${strength * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    {RULES.map((rule) => {
                      const passed = rule.test(password);
                      return (
                        <div key={rule.label} className={`flex items-center gap-2 text-xs transition-colors ${passed ? "text-primary" : "text-muted-foreground"}`}>
                          {passed ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0 opacity-50" />}
                          {rule.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 font-semibold text-base shadow-[0_0_20px_rgba(34,211,238,0.2)]"
              disabled={isLoading || !email || !allPassed}
              data-testid="button-register"
            >
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
