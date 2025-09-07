import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@shared/schema";

export default function ProductDetail() {
  const [match, params] = useRoute("/products/:id");
  const productId = params?.id;

  const { data: product, isLoading, error } = useQuery<Product>({
    queryKey: [`/api/products/${productId}`],
    enabled: !!productId,
  });

  const formatPrice = (price: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(typeof price === 'string' ? parseFloat(price) : price);
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (quantity <= 5) {
      return <Badge variant="destructive">{quantity} Low Stock</Badge>;
    }
    return <Badge variant="secondary">{quantity} In Stock</Badge>;
  };

  if (!match) {
    return <div className="text-center py-8">Invalid product URL</div>;
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="w-full h-96 rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-exclamation-circle text-destructive text-6xl mb-4"></i>
        <h3 className="text-lg font-semibold text-foreground mb-2">Product Not Found</h3>
        <p className="text-muted-foreground mb-6">The product you're looking for doesn't exist or has been removed.</p>
        <Button onClick={() => window.history.back()}>
          <i className="fas fa-arrow-left mr-2"></i>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="relative">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.productName} 
                  className="w-full h-96 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-96 bg-muted flex items-center justify-center rounded-lg">
                  <i className="fas fa-image text-muted-foreground text-4xl"></i>
                </div>
              )}
            </div>
            
            {/* QR Code */}
            {product.qrCodeUrl && (
              <Card className="p-4">
                <div className="text-center">
                  <h4 className="text-sm font-medium mb-2">Product QR Code</h4>
                  <img 
                    src={product.qrCodeUrl} 
                    alt="Product QR Code" 
                    className="w-32 h-32 mx-auto"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Scan to view this product
                  </p>
                </div>
              </Card>
            )}
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {product.productName}
              </h1>
              <p className="text-muted-foreground text-lg">
                Product ID: {product.productId}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {getStockBadge(product.quantity)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Color</h3>
                  <p className="text-lg text-foreground">{product.color}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Size</h3>
                  <p className="text-lg text-foreground">{product.size}</p>
                </div>
              </div>

              {product.category && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Category</h3>
                  <Badge variant="outline">{product.category}</Badge>
                </div>
              )}

              {product.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                  <p className="text-foreground">{product.description}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Stock Level</h3>
                <p className="text-lg text-foreground">{product.quantity} units available</p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
                className="flex-1"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Back
              </Button>
              <Button 
                onClick={() => window.print()}
                className="flex-1"
              >
                <i className="fas fa-print mr-2"></i>
                Print Details
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}