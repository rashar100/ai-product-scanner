import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useProduct } from "@/hooks/use-product";
import { getPrices } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, ArrowLeft, AlertCircle, ShoppingCart } from "lucide-react";
import { SiEbay, SiTarget, SiNewegg } from "react-icons/si";

export default function PricesPage() {
  const { product, prices, setPrices, setQuotaRemaining } = useProduct();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(!prices);

  useEffect(() => {
    if (!product) {
      setLocation("/");
      return;
    }

    if (!prices && product) {
      const fetchPrices = async () => {
        try {
          const query = product.name_en || product.name || "";
          if (!query) throw new Error("No product name to search");
          
          const res = await getPrices(query);
          setPrices(res.data);
          setQuotaRemaining(res.quotaRemaining);
        } catch (err: any) {
          toast({
            title: "Failed to fetch prices",
            description: err.message || "Please try again.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchPrices();
    }
  }, [product, prices, setLocation, setPrices, setQuotaRemaining, toast]);

  if (!product) return null;

  const StoreIcon = ({ storeKey, className = "" }: { storeKey: string, className?: string }) => {
    switch (storeKey.toLowerCase()) {
      case 'ebay': return <SiEbay className={className} />;
      case 'target': return <SiTarget className={className} />;
      case 'newegg': return <SiNewegg className={className} />;
      default: return <ShoppingCart className={className} />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Price Comparison</h1>
          <p className="text-muted-foreground">{product.name || product.name_en}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0 flex items-center p-4 gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="space-y-2 items-end flex flex-col">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : prices ? (
        <div className="space-y-6">
          {prices.prices.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No prices found</h3>
                <p className="text-muted-foreground max-w-md mt-2">
                  We couldn't find any current listings for this product. It might be out of stock or unavailable in the scanned regions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {prices.prices.map((p, i) => {
                const isBestDeal = prices.best_deal_key === p.store_key;
                return (
                  <Card 
                    key={i} 
                    className={`overflow-hidden transition-all hover:shadow-md ${isBestDeal ? 'border-primary ring-1 ring-primary/20 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'border-border/50'}`}
                  >
                    <div className="flex flex-col sm:flex-row">
                      <div className="flex-1 p-5 flex items-center gap-4">
                        <div className={`flex items-center justify-center h-12 w-12 rounded-xl ${isBestDeal ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground/70'}`}>
                          <StoreIcon storeKey={p.store_key} className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{p.store}</h3>
                            {isBestDeal && (
                              <Badge variant="default" className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider font-bold">Best Deal</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className={p.available ? "text-green-500 font-medium" : "text-destructive font-medium"}>
                              {p.available ? "In Stock" : "Out of Stock"}
                            </span>
                            {p.condition && (
                              <>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{p.condition}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-secondary/20 p-5 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l border-border/50 min-w-[200px]">
                        <div className="text-left sm:text-right">
                          <div className="text-2xl font-mono font-bold text-foreground">
                            {p.price}
                          </div>
                          {p.original_price && (
                            <div className="text-sm font-mono text-muted-foreground line-through decoration-destructive/50">
                              {p.original_price}
                            </div>
                          )}
                          {p.discount && (
                            <Badge variant="outline" className="mt-1 border-primary/50 text-primary font-mono bg-primary/5">
                              {p.discount}
                            </Badge>
                          )}
                        </div>
                        
                        <Button 
                          className="sm:mt-4 shadow-sm" 
                          variant={isBestDeal ? "default" : "secondary"}
                          disabled={!p.available}
                          asChild={p.available}
                          data-testid={`button-buy-${p.store_key}`}
                        >
                          {p.available ? (
                            <a href={p.url} target="_blank" rel="noopener noreferrer">
                              Buy Now <ExternalLink className="ml-2 h-4 w-4" />
                            </a>
                          ) : (
                            <span>Unavailable</span>
                          )}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          
          {prices.note && (
            <p className="text-xs text-center text-muted-foreground mt-8 bg-secondary/30 p-3 rounded-lg border border-border/50">
              {prices.note}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
