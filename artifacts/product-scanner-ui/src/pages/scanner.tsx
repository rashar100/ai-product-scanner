import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useProduct } from "@/hooks/use-product";
import { recognizeText, recognizeImage, getQuota, type QuotaInfo } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Search, Camera, ImageIcon, Loader2, Activity, Tag, Sparkles } from "lucide-react";

export default function ScannerPage() {
  const { product, setProduct, setQuotaRemaining, clear } = useProduct();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // Separate refs for camera vs gallery on each tab
  const barcodeCameraRef = useRef<HTMLInputElement>(null);
  const barcodeGalleryRef = useRef<HTMLInputElement>(null);
  const photoCameraRef   = useRef<HTMLInputElement>(null);
  const photoGalleryRef  = useRef<HTMLInputElement>(null);

  const refreshQuota = async () => {
    if (!user) return;
    try {
      setQuota(await getQuota());
    } catch {
      // quota display is optional — ignore errors
    }
  };

  useEffect(() => {
    refreshQuota();
  }, [user]);

  // ── core scan handler ──────────────────────────────────────────────
  const handleScan = async (
    apiFn: () => ReturnType<typeof recognizeText>,
  ) => {
    setIsLoading(true);
    clear();
    try {
      const res = await apiFn();
      setQuotaRemaining(res.quotaRemaining);
      await refreshQuota();
      if (res.data.found) {
        setProduct(res.data);
      } else {
        toast({
          title: "Not found",
          description: res.data.message || "We couldn't identify this product.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: err.status === 429 ? "Quota reached" : "Scan failed",
        description: err.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── image → base64 helper ──────────────────────────────────────────
  const readImageFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = (e.target?.result as string).split(",")[1];
        b64 ? resolve(b64) : reject(new Error("Empty image"));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    forBarcode = false,
  ) => {
    const file = e.target.files?.[0];
    // reset so the same file can be re-selected
    e.target.value = "";
    if (!file) return;
    const b64 = await readImageFile(file);
    handleScan(() => recognizeImage(b64, forBarcode));
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

          {/* Daily quota bar — visible only for logged-in users */}
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
                <span
                  className={`text-xs font-mono font-semibold tabular-nums ${
                    quota.remaining === 0 ? "text-destructive" : "text-primary"
                  }`}
                >
                  {quota.remaining}/{quota.daily_limit}
                </span>
              </div>
            </div>
          )}

          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-secondary/50">
              <TabsTrigger value="text"    data-testid="tab-text">Text</TabsTrigger>
              <TabsTrigger value="barcode" data-testid="tab-barcode">Barcode</TabsTrigger>
              <TabsTrigger value="image"   data-testid="tab-image">Photo</TabsTrigger>
            </TabsList>

            {/* ── Text tab ───────────────────────────────────────────── */}
            <TabsContent value="text" className="space-y-3">
              <Textarea
                placeholder="Describe the product… e.g. Sony WH-1000XM5 black"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-32 resize-none bg-background/50 focus-visible:ring-primary/50"
                disabled={isLoading}
                data-testid="input-text-search"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && query.trim()) {
                    handleScan(() => recognizeText(query.trim()));
                  }
                }}
              />
              <Button
                className="w-full h-11 font-semibold"
                disabled={!query.trim() || isLoading}
                onClick={() => handleScan(() => recognizeText(query.trim()))}
                data-testid="button-text-search"
              >
                {isLoading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Searching…</>
                  : <><Search className="mr-2 h-4 w-4" />Search</>}
              </Button>
            </TabsContent>

            {/* ── Barcode tab ────────────────────────────────────────── */}
            <TabsContent value="barcode" className="space-y-3">
              {/* hidden file inputs */}
              <input
                type="file" accept="image/*" capture="environment"
                className="hidden" ref={barcodeCameraRef}
                onChange={(e) => handleImageFile(e, true)}
                data-testid="input-barcode-camera"
              />
              <input
                type="file" accept="image/*"
                className="hidden" ref={barcodeGalleryRef}
                onChange={(e) => handleImageFile(e, true)}
                data-testid="input-barcode-gallery"
              />

              <Button
                variant="outline"
                className="w-full h-14 border border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-3 text-base"
                disabled={isLoading}
                onClick={() => barcodeCameraRef.current?.click()}
                data-testid="button-barcode-camera"
              >
                {isLoading
                  ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  : <Camera className="h-5 w-5 text-primary" />}
                Scan with Camera
              </Button>

              <Button
                variant="outline"
                className="w-full h-14 border border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-3 text-base"
                disabled={isLoading}
                onClick={() => barcodeGalleryRef.current?.click()}
                data-testid="button-barcode-gallery"
              >
                <ImageIcon className="h-5 w-5 text-primary" />
                Import from Gallery
              </Button>
            </TabsContent>

            {/* ── Photo tab ──────────────────────────────────────────── */}
            <TabsContent value="image" className="space-y-3">
              {/* hidden file inputs */}
              <input
                type="file" accept="image/*" capture="environment"
                className="hidden" ref={photoCameraRef}
                onChange={(e) => handleImageFile(e, false)}
                data-testid="input-photo-camera"
              />
              <input
                type="file" accept="image/*"
                className="hidden" ref={photoGalleryRef}
                onChange={(e) => handleImageFile(e, false)}
                data-testid="input-photo-gallery"
              />

              <Button
                variant="outline"
                className="w-full h-14 border border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-3 text-base"
                disabled={isLoading}
                onClick={() => photoCameraRef.current?.click()}
                data-testid="button-photo-camera"
              >
                {isLoading
                  ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  : <Camera className="h-5 w-5 text-primary" />}
                Take Photo
              </Button>

              <Button
                variant="outline"
                className="w-full h-14 border border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-3 text-base"
                disabled={isLoading}
                onClick={() => photoGalleryRef.current?.click()}
                data-testid="button-image-upload"
              >
                <ImageIcon className="h-5 w-5 text-primary" />
                Import from Gallery
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Product result card ──────────────────────────────────── */}
      {product && (
        <Card className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden border-border/50">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {product.category_emoji && (
                    <span className="text-2xl">{product.category_emoji}</span>
                  )}
                  <Badge variant="outline" className="text-xs uppercase tracking-wider">
                    {product.brand || product.category}
                  </Badge>
                </div>
                <CardTitle className="text-2xl font-bold leading-tight">
                  {product.name || product.name_en}
                </CardTitle>
                <CardDescription className="text-base mt-2">{product.description}</CardDescription>
              </div>
              {product.price_estimate && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                    Est. Price
                  </div>
                  <div className="text-2xl font-mono font-bold text-primary">
                    {product.price_estimate}
                  </div>
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
