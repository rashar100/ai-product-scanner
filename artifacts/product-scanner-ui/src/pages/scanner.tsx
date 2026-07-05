import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useProduct } from "@/hooks/use-product";
import { recognizeText, recognizeBarcode, recognizeImage, getQuota, type QuotaInfo } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Barcode, Camera, Loader2, Activity, Tag, Sparkles, Zap } from "lucide-react";

export default function ScannerPage() {
  const { product, setProduct, setQuotaRemaining, clear } = useProduct();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const refreshQuota = async () => {
    if (!user) return;
    try {
      setQuota(await getQuota());
    } catch {
      // نتجاهل الخطأ هنا — الحصة اختيارية في العرض
    }
  };

  useEffect(() => {
    refreshQuota();
  }, [user]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (type: "text" | "barcode" | "image", data: string) => {
    setIsLoading(true);
    clear(); // Clear previous results
    
    try {
      let res;
      if (type === "text") {
        res = await recognizeText(data);
      } else if (type === "barcode") {
        res = await recognizeBarcode(data);
      } else {
        res = await recognizeImage(data);
      }
      
      setQuotaRemaining(res.quotaRemaining);
      await refreshQuota();

      if (res.data.found) {
        setProduct(res.data);
      } else {
        toast({
          title: "Not found",
          description: res.data.message || "We couldn't identify this product.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({
        title: "Scan failed",
        description: err.message || "Please try again later.",
        variant: "destructive"
      });
      if (err.status === 429 && err.retryAfter) {
        // Handle rate limit
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64 = result.split(",")[1];
      if (base64) {
        handleScan("image", base64);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 w-full max-w-2xl mx-auto">
      
      {!product && (
        <div className="text-center space-y-4 mb-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Identify & Compare</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Scan any product by photo, barcode, or text to instantly uncover real-time prices across major retailers.
          </p>
        </div>
      )}

      <Card className="w-full shadow-2xl border-primary/20 bg-card/50 backdrop-blur-xl">
        <CardContent className="p-6">
          {user && quota !== null && (
            <div className="flex items-center justify-between mb-5 px-1">
              <span className="text-xs text-muted-foreground font-medium">Daily searches</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {Array.from({ length: quota.daily_limit }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-5 rounded-full transition-colors ${
                        i < quota.remaining ? "bg-primary" : "bg-secondary"
                      }`}
                    />
                  ))}
                </div>
                <span className={`text-xs font-mono font-semibold tabular-nums ${quota.remaining === 0 ? "text-destructive" : "text-primary"}`}>
                  {quota.remaining}/{quota.daily_limit}
                </span>
              </div>
            </div>
          )}
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/50">
              <TabsTrigger value="text" data-testid="tab-text">Text</TabsTrigger>
              <TabsTrigger value="barcode" data-testid="tab-barcode">Barcode</TabsTrigger>
              <TabsTrigger value="image" data-testid="tab-image">Photo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); if (query) handleScan("text", query); }} className="flex gap-2">
                <Input 
                  placeholder="e.g., Sony WH-1000XM5" 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 text-lg bg-background/50 focus-visible:ring-primary/50"
                  data-testid="input-text-search"
                />
                <Button type="submit" disabled={!query || isLoading} className="h-12 px-6" data-testid="button-text-search">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="barcode" className="space-y-4">
              <form onSubmit={(e) => { e.preventDefault(); if (barcode) handleScan("barcode", barcode); }} className="flex gap-2">
                <Input 
                  placeholder="Enter UPC/EAN..." 
                  value={barcode} 
                  onChange={(e) => setBarcode(e.target.value)}
                  className="h-12 text-lg font-mono bg-background/50 focus-visible:ring-primary/50"
                  data-testid="input-barcode-search"
                />
                <Button type="submit" disabled={!barcode || isLoading} className="h-12 px-6" data-testid="button-barcode-search">
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Barcode className="h-5 w-5" />}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="image" className="space-y-4">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
                data-testid="input-image-upload"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-32 border-dashed border-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 flex flex-col gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                data-testid="button-image-upload"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="text-muted-foreground font-medium">Analyzing image...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-primary" />
                    <span className="text-muted-foreground font-medium">Take a photo or upload</span>
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {product && (
        <Card className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden border-border/50">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {product.category_emoji && <span className="text-2xl">{product.category_emoji}</span>}
                  <Badge variant="outline" className="text-xs uppercase tracking-wider">{product.brand || product.category}</Badge>
                </div>
                <CardTitle className="text-2xl font-bold leading-tight">{product.name || product.name_en}</CardTitle>
                <CardDescription className="text-base mt-2">{product.description}</CardDescription>
              </div>
              {product.price_estimate && (
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Est. Price</div>
                  <div className="text-2xl font-mono font-bold text-primary">{product.price_estimate}</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {product.features && product.features.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="text-sm font-semibold text-muted-foreground">Key Features</div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {product.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {product.notes && (
              <div className="mt-4 p-3 bg-secondary rounded-lg text-sm text-secondary-foreground/80 border border-secondary-foreground/10">
                {product.notes}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/30 bg-card/30">
            <Button 
              className="w-full sm:flex-1 h-12 text-base font-semibold shadow-[0_0_20px_rgba(34,211,238,0.15)]" 
              onClick={() => setLocation("/prices")}
              data-testid="button-compare-prices"
            >
              <Tag className="mr-2 h-5 w-5" />
              Compare Prices
            </Button>
            <Button 
              variant="secondary" 
              className="w-full sm:flex-1 h-12 text-base font-semibold" 
              onClick={() => setLocation("/history")}
              data-testid="button-view-history"
            >
              <Activity className="mr-2 h-5 w-5 text-primary" />
              Price History
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
