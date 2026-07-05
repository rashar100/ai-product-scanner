import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useProduct } from "@/hooks/use-product";
import { getPriceHistory } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingDown, TrendingUp, Minus, Lightbulb, AlertCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function HistoryPage() {
  const { product, history, setHistory, setQuotaRemaining } = useProduct();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(!history);

  useEffect(() => {
    if (!product) {
      setLocation("/");
      return;
    }

    if (!history && product) {
      const fetchHistory = async () => {
        try {
          const query = product.name_en || product.name || "";
          if (!query) throw new Error("No product name to search");
          
          const res = await getPriceHistory(query);
          setHistory(res.data);
          setQuotaRemaining(res.quotaRemaining);
        } catch (err: any) {
          toast({
            title: "Failed to fetch history",
            description: err.message || "Please try again.",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      };
      fetchHistory();
    }
  }, [product, history, setLocation, setHistory, setQuotaRemaining, toast]);

  if (!product) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Price History</h1>
          <p className="text-muted-foreground">{product.name || product.name_en}</p>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6">
          <Skeleton className="h-[400px] w-full" />
        </Card>
      ) : history ? (
        history.found ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <div className="text-sm text-muted-foreground mb-1">Current Price</div>
                  <div className="text-2xl font-mono font-bold">{history.currency}{history.current_price}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <div className="text-sm text-muted-foreground mb-1">Lowest (6mo)</div>
                  <div className="text-2xl font-mono font-bold text-green-500">{history.currency}{history.lowest}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <div className="text-sm text-muted-foreground mb-1">Highest (6mo)</div>
                  <div className="text-2xl font-mono font-bold text-destructive">{history.currency}{history.highest}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex flex-col justify-center">
                  <div className="text-sm text-muted-foreground mb-1">Trend</div>
                  <div className="flex items-center gap-2">
                    {history.trend === 'down' ? (
                      <Badge className="bg-green-500/20 text-green-500 hover:bg-green-500/30 font-mono"><TrendingDown className="h-4 w-4 mr-1"/> {history.change_pct}%</Badge>
                    ) : history.trend === 'up' ? (
                      <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/30 font-mono"><TrendingUp className="h-4 w-4 mr-1"/> +{history.change_pct}%</Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono"><Minus className="h-4 w-4 mr-1"/> Stable</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="bg-secondary/30 pb-4 border-b border-border/50">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-full text-primary shrink-0">
                    <Lightbulb className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Buying Advice</CardTitle>
                    <CardDescription className="text-base font-medium text-foreground mt-1">
                      {history.advice}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history.months} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis 
                        dataKey="label" 
                        stroke="hsl(var(--muted-foreground))" 
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        domain={['dataMin - 20', 'dataMax + 20']} 
                        tickFormatter={(value) => `${history.currency}${value}`}
                        stroke="hsl(var(--muted-foreground))" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '0.5rem',
                          color: 'hsl(var(--popover-foreground))',
                          fontFamily: 'monospace'
                        }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        formatter={(value: number) => [`${history.currency}${value}`, 'Price']}
                      />
                      <ReferenceLine y={history.current_price} stroke="hsl(var(--primary))" strokeDasharray="3 3" opacity={0.5} />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: 'hsl(var(--background))', stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {history.note && (
              <p className="text-xs text-center text-muted-foreground mt-4 bg-secondary/30 p-3 rounded-lg border border-border/50">
                {history.note}
              </p>
            )}

          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No history available</h3>
              <p className="text-muted-foreground max-w-md mt-2">
                We don't have enough data to show a reliable price history for this product.
              </p>
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
