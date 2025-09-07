import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardMetrics, ProductsResponse, ActivityLogsResponse } from "@shared/schema";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: recentProductsData, isLoading: productsLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", { limit: 3 }],
  });

  const { data: activityLogsData, isLoading: logsLoading } = useQuery<ActivityLogsResponse>({
    queryKey: ["/api/activity-logs", { limit: 5 }],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) === 1 ? '' : 's'} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) === 1 ? '' : 's'} ago`;
  };

  const getStockStatusColor = (quantity: number) => {
    if (quantity <= 5) return "text-destructive bg-destructive/10";
    return "text-accent bg-accent/10";
  };

  const getActivityIcon = (module: string) => {
    switch (module) {
      case 'Products': return 'fa-box text-accent';
      case 'Invoices': return 'fa-file-invoice text-primary';
      case 'Users': return 'fa-users text-purple-500';
      case 'Inventory': return 'fa-exclamation-triangle text-destructive';
      default: return 'fa-circle text-muted-foreground';
    }
  };

  return (
    <div className="space-y-8">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-total-products">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-16 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-products">
                    {metrics?.totalProducts?.toLocaleString() || 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-box text-primary w-6 h-6"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-low-stock">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-destructive" data-testid="text-low-stock">
                    {metrics?.lowStockItems || 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-exclamation-triangle text-destructive w-6 h-6"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-invoices">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Invoices</p>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-2xl font-bold text-accent" data-testid="text-pending-invoices">
                    {metrics?.pendingInvoices || 0}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-clock text-accent w-6 h-6"></i>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-monthly-revenue">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                {metricsLoading ? (
                  <Skeleton className="h-8 w-20 mt-2" />
                ) : (
                  <p className="text-lg font-bold text-foreground" data-testid="text-monthly-revenue">
                    {formatCurrency(metrics?.monthlyRevenue || 0)}
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <i className="fas fa-dollar-sign text-accent w-6 h-6"></i>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <Card data-testid="card-recent-products">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Recent Products</h3>
          </div>
          <CardContent className="p-6">
            {productsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="w-12 h-12 rounded-md" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentProductsData?.products?.length ? (
              <div className="space-y-4">
                {recentProductsData.products.slice(0, 3).map((product: any) => (
                  <div key={product.id} className="flex items-center space-x-4" data-testid={`product-${product.id}`}>
                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.productName} className="w-12 h-12 rounded-md object-cover" />
                      ) : (
                        <i className="fas fa-image text-muted-foreground"></i>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{product.productName}</p>
                      <p className="text-xs text-muted-foreground">{product.productId}</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStockStatusColor(product.quantity)}`}>
                      {product.quantity <= 5 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-box text-muted-foreground text-3xl mb-4"></i>
                <p className="text-sm text-muted-foreground">No products found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card data-testid="card-recent-activity">
          <div className="p-6 border-b border-border">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          </div>
          <CardContent className="p-6">
            {logsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <Skeleton className="w-2 h-2 rounded-full mt-2" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activityLogsData?.logs?.length ? (
              <div className="space-y-4">
                {activityLogsData.logs.map((log: any) => (
                  <div key={log.id} className="flex items-start space-x-3" data-testid={`activity-${log.id}`}>
                    <div className={`w-2 h-2 rounded-full mt-2 ${getActivityIcon(log.module).includes('accent') ? 'bg-accent' : 
                      getActivityIcon(log.module).includes('primary') ? 'bg-primary' : 
                      getActivityIcon(log.module).includes('destructive') ? 'bg-destructive' : 'bg-muted-foreground'}`}></div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{log.action}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                        <span>{formatTimeAgo(log.createdAt)}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${
                          log.module === 'Products' ? 'bg-accent/10 text-accent' :
                          log.module === 'Invoices' ? 'bg-primary/10 text-primary' :
                          log.module === 'Users' ? 'bg-purple-100 text-purple-600' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {log.module}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <i className="fas fa-history text-muted-foreground text-3xl mb-4"></i>
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
