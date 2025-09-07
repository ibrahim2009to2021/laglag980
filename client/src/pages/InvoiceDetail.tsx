import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { type Invoice, type InvoiceItem, type Product } from "@shared/schema";

export default function InvoiceDetail() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { id } = useParams();

  const { data: invoice, isLoading, error } = useQuery<Invoice & { items: (InvoiceItem & { product: Product })[] }>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("PUT", `/api/invoices/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice status updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update invoice status",
        variant: "destructive",
      });
    },
  });

  const downloadPDF = async (invoiceId: string, invoiceNumber: string) => {
    try {
      const response = await apiRequest("POST", `/api/invoices/${invoiceId}/pdf`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "PDF saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PDF",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    // Hide action buttons and other non-printable elements
    const actionButtons = document.querySelectorAll('[data-print-hide]');
    actionButtons.forEach(el => (el as HTMLElement).style.display = 'none');
    
    // Print the page
    window.print();
    
    // Restore hidden elements after print
    setTimeout(() => {
      actionButtons.forEach(el => (el as HTMLElement).style.display = '');
    }, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: string | number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(typeof amount === 'string' ? parseFloat(amount) : amount);
  };

  const getStatusBadge = (status: string) => {
    return status === 'Processed' ? (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Processed</Badge>
    ) : (
      <Badge variant="secondary">Pending</Badge>
    );
  };

  const canProcessInvoice = () => {
    return ['Admin', 'Manager'].includes(user?.role || '');
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-center py-8">
              <i className="fas fa-exclamation-circle text-destructive text-4xl mb-4"></i>
              <p className="text-sm text-muted-foreground mb-4">
                {error ? "Failed to load invoice" : "Invoice not found"}
              </p>
              <Link href="/invoices">
                <Button variant="outline">
                  <i className="fas fa-arrow-left w-4 h-4 mr-2"></i>
                  Back to Invoices
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/invoices">
            <Button variant="ghost" size="icon" data-print-hide>
              <i className="fas fa-arrow-left w-4 h-4"></i>
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground">
              Created on {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2" data-print-hide>
          {getStatusBadge(invoice.status)}
          <Button
            variant="outline"
            onClick={handlePrint}
            data-testid="button-print"
          >
            <i className="fas fa-print w-4 h-4 mr-2"></i>
            Print
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadPDF(invoice.id, invoice.invoiceNumber)}
            data-testid="button-save-pdf"
          >
            <i className="fas fa-file-pdf w-4 h-4 mr-2"></i>
            Save as PDF
          </Button>
          {invoice.status === 'Pending' && canProcessInvoice() && (
            <Button
              onClick={() => updateStatusMutation.mutate('Processed')}
              disabled={updateStatusMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
              data-testid="button-process-invoice"
            >
              <i className="fas fa-check w-4 h-4 mr-2"></i>
              {updateStatusMutation.isPending ? "Processing..." : "Mark as Processed"}
            </Button>
          )}
        </div>
      </div>

      {/* Customer Information */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer Name</p>
              <p className="font-medium text-foreground">{invoice.customerName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium text-foreground">{invoice.customerPhone}</p>
            </div>
            {invoice.customerEmail && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{invoice.customerEmail}</p>
              </div>
            )}
            {invoice.customerAddress && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium text-foreground">{invoice.customerAddress}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoice Items */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Quantity</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items?.map((item: any, index: number) => (
                  <tr key={index} data-testid={`invoice-item-${index}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.product?.productName || 'Unknown Product'}</p>
                        <p className="text-sm text-muted-foreground">{item.product?.productId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Totals */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Invoice Summary</h3>
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {parseFloat(invoice.discountAmount || "0") > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Discount ({(parseFloat(invoice.discountPercentage || "0") * 100).toFixed(1)}%):
                </span>
                <span className="font-medium text-foreground">-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax ({(parseFloat(invoice.taxRate || "0") * 100).toFixed(1)}%):
              </span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-3">
              <span>Total:</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
          
          {invoice.notes && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Notes:</p>
              <p className="text-sm text-foreground">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}