import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useProduct } from "@/hooks/use-product";
import { ScanLine, User as UserIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const { quotaRemaining } = useProduct();
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-4xl mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-primary transition-colors hover:text-primary/80" data-testid="link-home">
            <ScanLine className="h-5 w-5" />
            <span>Lens</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {quotaRemaining !== null && (
              <Badge variant="secondary" className="hidden sm:flex font-mono items-center gap-1" data-testid="badge-quota">
                <Zap className="h-3 w-3 text-primary" />
                {quotaRemaining} left
              </Badge>
            )}
            
            {!isLoading && (
              user ? (
                <Link href="/account" data-testid="link-account">
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <UserIcon className="h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <Link href="/login" data-testid="link-login">
                  <Button variant="default" size="sm" className="font-semibold tracking-wide shadow-[0_0_15px_rgba(34,211,238,0.3)]">
                    Sign In
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-4xl mx-auto p-4 md:p-6 lg:p-8 flex flex-col">
        {children}
      </main>
    </div>
  );
}
