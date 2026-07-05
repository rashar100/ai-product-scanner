import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProduct } from "@/hooks/use-product";
import { logout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Loader2, User, Zap, LogOut, ShieldCheck, CalendarDays } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccountPage() {
  const [, setLocation] = useLocation();
  const { user, logout: clearUser } = useAuth();
  const { quotaRemaining } = useProduct();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">You're not signed in.</p>
        <Button onClick={() => setLocation("/login")} data-testid="button-go-login">Sign In</Button>
      </div>
    );
  }

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      clearUser();
      toast({ title: "Signed out", description: "See you next time." });
      setLocation("/");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not sign out.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const quotaUsed = 25 - (quotaRemaining ?? 25);
  const quotaPct = Math.min(100, (quotaUsed / 25) * 100);

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto gap-6 py-8">
      <div className="text-center space-y-1">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{user.email}</h1>
        <Badge variant="secondary" className="text-xs">Registered User</Badge>
      </div>

      <Card className="w-full border-border/50 bg-card/60 backdrop-blur-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Daily Quota
          </CardTitle>
          <CardDescription>Resets every 24 hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Scans used today</span>
            <span className="font-mono font-bold text-foreground">{quotaUsed} / 25</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${quotaPct > 80 ? "bg-red-500" : quotaPct > 50 ? "bg-yellow-500" : "bg-primary"}`}
              style={{ width: `${quotaPct}%` }}
            />
          </div>
          {quotaRemaining !== null && (
            <p className="text-xs text-muted-foreground">
              {quotaRemaining} scan{quotaRemaining !== 1 ? "s" : ""} remaining today
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="w-full border-border/50 bg-card/60 backdrop-blur-xl shadow-lg">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm font-medium" data-testid="text-member-since">{formatDate(user.created_at)}</p>
            </div>
          </div>
          <Separator className="bg-border/40" />
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Account status</p>
              <p className="text-sm font-medium text-primary">{user.is_active ? "Active" : "Inactive"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full h-11 font-semibold"
        onClick={handleLogout}
        disabled={isLoading}
        data-testid="button-logout"
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogOut className="h-4 w-4 mr-2" /> Sign Out</>}
      </Button>
    </div>
  );
}
