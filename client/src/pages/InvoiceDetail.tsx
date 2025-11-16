import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { type Invoice, type InvoiceItem, type Product } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Discount form schema
const discountSchema = z.object({
  discountAmount: z.number().min(0, "Discount cannot be negative")
});

type DiscountForm = z.infer<typeof discountSchema>;

export default function InvoiceDetail() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { id } = useParams();
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingQuantities, setEditingQuantities] = useState<Record<string, number>>({});

  const { data: invoice, isLoading, error } = useQuery<Invoice & { items: (InvoiceItem & { product: Product })[] }>({
    queryKey: [`/api/invoices/${id}`],
    enabled: !!id,
  });

  const { data: productsData } = useQuery<{ products: Product[]; total: number }>({
    queryKey: ["/api/products", { limit: 1000 }],
    enabled: isAddingProduct,
  });

  const discountForm = useForm<DiscountForm>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      discountAmount: 0
    }
  });

  // Reset form when invoice data changes - using useEffect to prevent re-render loops
  useEffect(() => {
    if (invoice && !discountForm.formState.isDirty) {
      const currentDiscountAmount = parseFloat(invoice.discountAmount || "0");
      discountForm.reset({
        discountAmount: currentDiscountAmount
      });
    }
  }, [invoice?.discountAmount, discountForm.formState.isDirty]);

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

  const updateDiscountMutation = useMutation({
    mutationFn: async (discountAmount: number) => {
      console.log("Making API request with discount amount:", discountAmount, typeof discountAmount);
      
      const requestBody = { discountAmount };
      console.log("Request body:", requestBody);
      
      const response = await apiRequest("PUT", `/api/invoices/${id}/discount`, requestBody);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", response.status, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || `HTTP ${response.status}` };
        }
        throw { response: errorData, status: response.status };
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Discount updated successfully",
      });
      setIsEditingDiscount(false);
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
    },
    onError: (error: any) => {
      console.error("Discount update error:", error);
      
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
      
      // Try to extract specific error message from API response
      let errorMessage = "Failed to update discount";
      try {
        if (error.response) {
          const responseData = error.response;
          if (responseData.message) {
            errorMessage = responseData.message;
          } else if (responseData.errors && responseData.errors.length > 0) {
            errorMessage = responseData.errors[0].message || errorMessage;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
      } catch (parseError) {
        console.error("Error parsing error message:", parseError);
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ productId, quantity, unitPrice }: { productId: string; quantity: number; unitPrice: number }) => {
      const response = await apiRequest("POST", `/api/invoices/${id}/items`, { productId, quantity, unitPrice });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product added to invoice",
      });
      setIsAddingProduct(false);
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
    },
    onError: (error: any) => {
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
        description: error.response?.message || "Failed to add product",
        variant: "destructive",
      });
    },
  });

  const updateItemQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const response = await apiRequest("PUT", `/api/invoices/${id}/items/${itemId}`, { quantity });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Quantity updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
    },
    onError: (error: any) => {
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
        description: error.response?.message || "Failed to update quantity",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await apiRequest("DELETE", `/api/invoices/${id}/items/${itemId}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Item removed from invoice",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
    },
    onError: (error: any) => {
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
        description: error.response?.message || "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/invoices/${id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice marked as deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      // Refresh current invoice to show deleted status
      queryClient.invalidateQueries({ queryKey: [`/api/invoices/${id}`] });
    },
    onError: (error: any) => {
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
        description: error.response?.message || "Failed to delete invoice",
        variant: "destructive",
      });
    },
  });

  const onSubmitDiscount = (data: DiscountForm) => {
    console.log("Form submission data:", data);
    console.log("discountAmount type:", typeof data.discountAmount);
    console.log("discountAmount value:", data.discountAmount);
    
    // Ensure it's a number for the API call
    const numericDiscountAmount = Number(data.discountAmount);
    console.log("Converted to number:", numericDiscountAmount, typeof numericDiscountAmount);
    
    if (isNaN(numericDiscountAmount)) {
      toast({
        title: "Error",
        description: "Please enter a valid discount amount",
        variant: "destructive",
      });
      return;
    }
    
    if (numericDiscountAmount < 0) {
      toast({
        title: "Error",
        description: "Discount amount cannot be negative",
        variant: "destructive",
      });
      return;
    }
    
    updateDiscountMutation.mutate(numericDiscountAmount);
  };

  const cancelDiscountEdit = () => {
    setIsEditingDiscount(false);
    if (invoice) {
      discountForm.reset({
        discountAmount: parseFloat(invoice.discountAmount || "0")
      });
    }
  };

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

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
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
    if (status === 'Processed') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Processed</Badge>;
    }
    if (status === 'Deleted') {
      return <Badge className="bg-destructive/10 text-destructive">Deleted</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
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
              Created on {invoice.createdAt ? formatDate(invoice.createdAt) : 'Unknown date'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2" data-print-hide>
          {getStatusBadge(invoice.status || 'Unknown')}
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-process-invoice"
            >
              <i className="fas fa-check w-4 h-4 mr-2"></i>
              {updateStatusMutation.isPending ? "Processing..." : "Mark as Processed"}
            </Button>
          )}
          {/* Delete button - Admin only */}
          {user?.role === 'Admin' && invoice.status !== 'Deleted' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  data-testid="button-delete-invoice"
                >
                  <i className="fas fa-trash w-4 h-4 mr-2"></i>
                  Delete Invoice
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete invoice {invoice.invoiceNumber}? This will mark the invoice as deleted and no further actions can be performed on it. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteInvoiceMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Invoice Items</h3>
            {invoice.status === 'Pending' && canProcessInvoice() && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingProduct(true)}
                data-testid="button-add-product"
              >
                <i className="fas fa-plus w-4 h-4 mr-2"></i>
                Add Product
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase min-w-[180px]">Product</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Colors</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Sizes</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Manufacturer</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Qty</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                  {invoice.status === 'Pending' && canProcessInvoice() && (
                    <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoice.items?.map((item: any, index: number) => (
                  <tr key={index} data-testid={`invoice-item-${index}`}>
                    <td className="px-3 py-3 min-w-[180px]">
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.product?.productName || 'Unknown Product'}</p>
                        <p className="text-xs text-muted-foreground">{item.product?.productId}</p>
                        {item.product?.description && (
                          <p className="text-xs text-muted-foreground mt-1 max-w-[160px] line-clamp-2" title={item.product.description}>
                            {item.product.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-foreground">
                        {Array.isArray(item.product?.color) ? item.product.color.join(', ') : (item.product?.color || '-')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-foreground">
                        {Array.isArray(item.product?.size) ? item.product.size.join(', ') : (item.product?.size || '-')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-sm text-foreground">
                        {item.product?.manufacturer || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {item.product?.category ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {item.product.category}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {invoice.status === 'Pending' && canProcessInvoice() ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={editingQuantities[item.id] !== undefined ? editingQuantities[item.id] : item.quantity}
                            onChange={(e) => {
                              const newValue = parseInt(e.target.value);
                              setEditingQuantities(prev => ({ ...prev, [item.id]: newValue }));
                            }}
                            onBlur={() => {
                              const newQuantity = editingQuantities[item.id];
                              if (newQuantity !== undefined && newQuantity !== item.quantity && newQuantity > 0) {
                                updateItemQuantityMutation.mutate({ itemId: item.id, quantity: newQuantity });
                              }
                              setEditingQuantities(prev => {
                                const { [item.id]: _, ...rest } = prev;
                                return rest;
                              });
                            }}
                            className="w-20 h-8 text-sm"
                            data-testid={`input-quantity-${index}`}
                          />
                        </div>
                      ) : (
                        <span className="text-sm text-foreground font-medium">{item.quantity}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-foreground">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-sm font-medium text-foreground">{formatCurrency(item.totalPrice)}</td>
                    {invoice.status === 'Pending' && canProcessInvoice() && (
                      <td className="px-3 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Are you sure you want to remove this item from the invoice?')) {
                              deleteItemMutation.mutate(item.id);
                            }
                          }}
                          className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-item-${index}`}
                        >
                          <i className="fas fa-trash w-3 h-3"></i>
                        </Button>
                      </td>
                    )}
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={invoice.status === 'Pending' && canProcessInvoice() ? 9 : 8} className="px-4 py-8 text-center text-muted-foreground">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Invoice Summary</h3>
            {invoice.status === 'Pending' && !isEditingDiscount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingDiscount(true)}
                data-testid="button-edit-discount"
              >
                <i className="fas fa-edit w-4 h-4 mr-2"></i>
                Edit Discount
              </Button>
            )}
          </div>
          <div className="max-w-md ml-auto space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal:</span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.subtotal || 0)}</span>
            </div>
            
            {/* Discount Section - Enhanced with editing capability */}
            {invoice.status === 'Pending' && isEditingDiscount ? (
              <form onSubmit={discountForm.handleSubmit(onSubmitDiscount)} className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Label htmlFor="discount-amount" className="text-sm text-muted-foreground min-w-fit">
                    Discount Amount:
                  </Label>
                  <Input
                    id="discount-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-24 h-8 text-sm"
                    {...discountForm.register("discountAmount", { valueAsNumber: true })}
                    data-testid="input-discount-amount"
                  />
                  <div className="flex space-x-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updateDiscountMutation.isPending}
                      className="h-8 px-2 bg-blue-600 hover:bg-blue-700 text-white"
                      data-testid="button-save-discount"
                    >
                      {updateDiscountMutation.isPending ? (
                        <i className="fas fa-spinner fa-spin w-3 h-3"></i>
                      ) : (
                        <i className="fas fa-check w-3 h-3"></i>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={cancelDiscountEdit}
                      className="h-8 px-2"
                      data-testid="button-cancel-discount"
                    >
                      <i className="fas fa-times w-3 h-3"></i>
                    </Button>
                  </div>
                </div>
                {discountForm.formState.errors.discountAmount && (
                  <p className="text-sm text-destructive">
                    {discountForm.formState.errors.discountAmount.message}
                  </p>
                )}
              </form>
            ) : (
              parseFloat(invoice.discountAmount || "0") > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Discount:
                  </span>
                  <span className="font-medium text-foreground">-{formatCurrency(invoice.discountAmount || 0)}</span>
                </div>
              )
            )}
            
            <div className="flex justify-between text-lg font-bold text-foreground border-t border-border pt-3">
              <span>Total:</span>
              <span>{formatCurrency(invoice.total || 0)}</span>
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

      {/* Add Product Dialog */}
      <Dialog open={isAddingProduct} onOpenChange={setIsAddingProduct}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add Product to Invoice</DialogTitle>
            <DialogDescription>
              Select a product and specify the quantity to add to this invoice.
            </DialogDescription>
          </DialogHeader>
          <AddProductForm 
            products={productsData?.products || []}
            onAdd={(productId, quantity, unitPrice) => {
              addItemMutation.mutate({ productId, quantity, unitPrice });
            }}
            isLoading={addItemMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add Product Form Component
function AddProductForm({ 
  products, 
  onAdd, 
  isLoading 
}: { 
  products: Product[]; 
  onAdd: (productId: string, quantity: number, unitPrice: number) => void;
  isLoading: boolean;
}) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProduct) {
      onAdd(selectedProduct.id, quantity, parseFloat(selectedProduct.price));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="product">Product</Label>
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger id="product" data-testid="select-product">
            <SelectValue placeholder="Select a product" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.productName} - {product.productId} (${parseFloat(product.price).toFixed(2)}) - Stock: {product.quantity}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {selectedProduct && (
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Price:</span> 
              <span className="ml-2 font-medium">${parseFloat(selectedProduct.price).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Stock:</span>
              <span className="ml-2 font-medium">{selectedProduct.quantity}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Colors:</span>
              <span className="ml-2">{Array.isArray(selectedProduct.color) ? selectedProduct.color.join(', ') : selectedProduct.color}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Sizes:</span>
              <span className="ml-2">{Array.isArray(selectedProduct.size) ? selectedProduct.size.join(', ') : selectedProduct.size}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity</Label>
        <Input
          id="quantity"
          type="number"
          min="1"
          max={selectedProduct?.quantity || 1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          data-testid="input-add-quantity"
        />
      </div>

      {selectedProduct && (
        <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg">
          <span className="font-medium">Total:</span>
          <span className="text-lg font-bold">
            ${(parseFloat(selectedProduct.price) * quantity).toFixed(2)}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectedProductId("")}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!selectedProductId || isLoading}
          data-testid="button-confirm-add-product"
        >
          {isLoading ? "Adding..." : "Add to Invoice"}
        </Button>
      </div>
    </form>
  );
}