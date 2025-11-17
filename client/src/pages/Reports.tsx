import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type DashboardData = {
  totalProducts: number;
  lowStockItems: number;
  pendingInvoices: number;
  monthlyRevenue: number;
};

type Invoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  total: string;
  customerName: string;
  createdAt: string;
};

type InvoicesData = {
  invoices: Invoice[];
  total: number;
};

type ManufacturerStat = {
  manufacturer: string;
  totalQuantitySold: number;
  totalRevenue: number;
  productCount: number;
};

export default function Reports() {
  const [reportType, setReportType] = useState<string>("sales");
  const [dateRange, setDateRange] = useState<string>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard/metrics"],
  });

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery<InvoicesData>({
    queryKey: ["/api/invoices", { limit: 1000 }],
  });

  const { data: manufacturerStats, isLoading: isManufacturerLoading } = useQuery<ManufacturerStat[]>({
    queryKey: ["/api/reports/manufacturers", { 
      startDate: dateRange === "custom" ? startDate : undefined,
      endDate: dateRange === "custom" ? endDate : undefined,
      range: dateRange !== "custom" ? dateRange : undefined
    }],
    enabled: reportType === "manufacturers",
  });

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `$${num.toFixed(2)}`;
  };

  const calculateSalesReport = () => {
    if (!invoicesData?.invoices) return null;
    
    const processedInvoices = invoicesData.invoices.filter((inv: any) => inv.status === 'Processed');
    const totalRevenue = processedInvoices.reduce((sum: number, inv: any) => sum + parseFloat(inv.total), 0);
    const avgOrderValue = processedInvoices.length > 0 ? totalRevenue / processedInvoices.length : 0;

    return {
      totalInvoices: processedInvoices.length,
      totalRevenue,
      avgOrderValue,
      pendingInvoices: invoicesData.invoices.filter((inv: any) => inv.status === 'Pending').length,
    };
  };

  const calculateInventoryReport = () => {
    return {
      totalProducts: dashboardData?.totalProducts || 0,
      lowStockItems: dashboardData?.lowStockItems || 0,
    };
  };

  const salesReport = calculateSalesReport();
  const inventoryReport = calculateInventoryReport();

  const downloadReport = () => {
    let csvContent = "";
    
    if (reportType === "sales" && salesReport) {
      csvContent = "Sales Report\n\n";
      csvContent += "Metric,Value\n";
      csvContent += `Total Processed Invoices,${salesReport.totalInvoices}\n`;
      csvContent += `Total Revenue,${formatCurrency(salesReport.totalRevenue)}\n`;
      csvContent += `Average Order Value,${formatCurrency(salesReport.avgOrderValue)}\n`;
      csvContent += `Pending Invoices,${salesReport.pendingInvoices}\n`;
    } else if (reportType === "inventory") {
      csvContent = "Inventory Report\n\n";
      csvContent += "Metric,Value\n";
      csvContent += `Total Products,${inventoryReport.totalProducts}\n`;
      csvContent += `Low Stock Items,${inventoryReport.lowStockItems}\n`;
    } else if (reportType === "manufacturers" && manufacturerStats) {
      csvContent = "Manufacturer Report\n\n";
      csvContent += "Manufacturer,Total Quantity Sold,Total Revenue,Product Count\n";
      manufacturerStats.forEach(stat => {
        csvContent += `${stat.manufacturer},${stat.totalQuantitySold},${stat.totalRevenue},${stat.productCount}\n`;
      });
      csvContent += "\nTotals,";
      csvContent += `${manufacturerStats.reduce((sum, stat) => sum + stat.totalQuantitySold, 0)},`;
      csvContent += `${manufacturerStats.reduce((sum, stat) => sum + stat.totalRevenue, 0)},`;
      csvContent += `${manufacturerStats.reduce((sum, stat) => sum + stat.productCount, 0)}\n`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Report Type
                </label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales Report</SelectItem>
                    <SelectItem value="inventory">Inventory Report</SelectItem>
                    <SelectItem value="manufacturers">Manufacturer Report</SelectItem>
                    <SelectItem value="invoices">Invoice Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Date Range
                </label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                    <SelectItem value="quarter">Last 3 Months</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Duration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={downloadReport}
                  className="w-full md:w-auto"
                  data-testid="button-download-report"
                >
                  <i className="fas fa-download mr-2"></i>
                  Download CSV
                </Button>
              </div>
            </div>

            {dateRange === "custom" && (
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    data-testid="input-start-date"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                    data-testid="input-end-date"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Report */}
      {reportType === "sales" && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {isDashboardLoading || isInvoicesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          ) : salesReport ? (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{salesReport.totalInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">Processed orders</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(salesReport.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">From all sales</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Average Order Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(salesReport.avgOrderValue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Per invoice</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Pending Invoices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{salesReport.pendingInvoices}</div>
                  <p className="text-xs text-muted-foreground mt-1">Awaiting processing</p>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {/* Inventory Report */}
      {reportType === "inventory" && (
        <div className="grid gap-6 md:grid-cols-2">
          {isDashboardLoading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Products
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{inventoryReport.totalProducts}</div>
                  <p className="text-xs text-muted-foreground mt-1">In inventory</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Low Stock Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{inventoryReport.lowStockItems}</div>
                  <p className="text-xs text-muted-foreground mt-1">Need restocking</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Manufacturer Report */}
      {reportType === "manufacturers" && (
        <Card>
          <CardHeader>
            <CardTitle>Manufacturer Report</CardTitle>
          </CardHeader>
          <CardContent>
            {isManufacturerLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : manufacturerStats && manufacturerStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Manufacturer</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Products Sold (Qty)</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Total Revenue</th>
                      <th className="px-4 py-3 text-right text-sm font-medium">Unique Products</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {manufacturerStats.map((stat, index) => (
                      <tr key={index} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">
                          {stat.manufacturer}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {stat.totalQuantitySold.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 font-semibold">
                          {formatCurrency(stat.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {stat.productCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted font-bold">
                    <tr>
                      <td className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right">
                        {manufacturerStats.reduce((sum, stat) => sum + stat.totalQuantitySold, 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatCurrency(manufacturerStats.reduce((sum, stat) => sum + stat.totalRevenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {manufacturerStats.reduce((sum, stat) => sum + stat.productCount, 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No manufacturer data available. Process some invoices to see statistics.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice Summary */}
      {reportType === "invoices" && (
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isInvoicesLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : invoicesData?.invoices ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold">{invoicesData.invoices.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {invoicesData.invoices.filter((inv: any) => inv.status === 'Pending').length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Processed</p>
                    <p className="text-2xl font-bold text-green-600">
                      {invoicesData.invoices.filter((inv: any) => inv.status === 'Processed').length}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Count</th>
                        <th className="px-4 py-2 text-left text-sm font-medium">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {['Pending', 'Processed', 'Deleted'].map((status) => {
                        const count = invoicesData.invoices.filter((inv: any) => inv.status === status).length;
                        const percentage = ((count / invoicesData.invoices.length) * 100).toFixed(1);
                        return (
                          <tr key={status}>
                            <td className="px-4 py-3">{status}</td>
                            <td className="px-4 py-3 font-semibold">{count}</td>
                            <td className="px-4 py-3">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
