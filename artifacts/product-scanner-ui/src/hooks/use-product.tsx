import React, { createContext, useContext, useState, ReactNode } from "react";
import type { ProductInfo, PriceResult, PriceHistoryResult } from "@/lib/api";

interface ProductContextType {
  product: ProductInfo | null;
  setProduct: (p: ProductInfo | null) => void;
  prices: PriceResult | null;
  setPrices: (p: PriceResult | null) => void;
  history: PriceHistoryResult | null;
  setHistory: (h: PriceHistoryResult | null) => void;
  quotaRemaining: number | null;
  setQuotaRemaining: (q: number | null) => void;
  clear: () => void;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [prices, setPrices] = useState<PriceResult | null>(null);
  const [history, setHistory] = useState<PriceHistoryResult | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

  const clear = () => {
    setProduct(null);
    setPrices(null);
    setHistory(null);
  };

  return (
    <ProductContext.Provider
      value={{
        product,
        setProduct,
        prices,
        setPrices,
        history,
        setHistory,
        quotaRemaining,
        setQuotaRemaining,
        clear,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (!context) throw new Error("useProduct must be used within ProductProvider");
  return context;
}
