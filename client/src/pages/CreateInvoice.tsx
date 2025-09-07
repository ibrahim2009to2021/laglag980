import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

const createInvoiceSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Valid email format").optional().or(z.literal("")),
  customerPhone: z.string().min(1, "Phone number is required"),
  customerAddress: z.string().optional(),
  discountPercentage: z.string().optional(),
  taxRate: z.string().optional(),
  notes: z.string().optional(),
});

type CreateInvoiceForm = z.infer<typeof createInvoiceSchema>;

interface InvoiceItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    id: string;
    productName: string;
    size: string;
    price: string;
  };
}

export default function CreateInvoice() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const form = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      customerAddress: "",
      discountPercentage: "0",
      taxRate: "8.5",
      notes: "",
    },
  });

  const { data: productsData } = useQuery({
    queryKey: ["/api/products", { limit: 100 }],
    enabled: showProductDialog,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: { invoice: any; items: any[] }) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Invoice created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      navigate("/invoices");
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
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const addProductToInvoice = (product: any) => {
    if (selectedProducts.has(product.id)) {
      toast({
        title: "Info",
        description: "Product already added to invoice",
        variant: "destructive",
      });
      return;
    }

    const unitPrice = parseFloat(product.price);
    const newItem: InvoiceItem = {
      productId: product.id,
      quantity: 1,
      unitPrice,
      totalPrice: unitPrice,
      product: {
        id: product.id,
        productName: product.productName,
        size: product.size,
        price: product.price,
      },
    };

    setInvoiceItems(prev => [...prev, newItem]);
    setSelectedProducts(prev => new Set(Array.from(prev).concat([product.id])));
    setShowProductDialog(false);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    
    setInvoiceItems(prev => prev.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantity,
          totalPrice: item.unitPrice * quantity,
        };
      }
      return item;
    }));
  };

  const removeItem = (index: number) => {
    const item = invoiceItems[index];
    setInvoiceItems(prev => prev.filter((_, i) => i !== index));
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.productId);
      return newSet;
    });
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountPercentage = parseFloat(form.watch("discountPercentage") || "0") / 100;
    const discountAmount = subtotal * discountPercentage;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const taxRate = parseFloat(form.watch("taxRate") || "8.5") / 100;
    const taxAmount = subtotalAfterDiscount * taxRate;
    const total = subtotalAfterDiscount + taxAmount;
    
    return { subtotal, discountAmount, taxAmount, total };
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  const onSubmit = async (data: CreateInvoiceForm) => {
    if (invoiceItems.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one product to the invoice",
        variant: "destructive",
      });
      return;
    }

    const invoiceData = {
      ...data,
      subtotal: subtotal.toFixed(2),
      discountPercentage: (parseFloat(data.discountPercentage || "0") / 100).toFixed(4),
      discountAmount: discountAmount.toFixed(2),
      taxRate: (parseFloat(data.taxRate || "8.5") / 100).toFixed(4),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2),
    };

    const itemsData = invoiceItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      totalPrice: item.totalPrice.toFixed(2),
    }));

    createInvoiceMutation.mutate({
      invoice: invoiceData,
      items: itemsData,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Create New Invoice</h3>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Customer Information */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="text-sm font-medium text-foreground mb-4">Customer Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter customer name" 
                            {...field}
                            data-testid="input-customer-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="email"
                            placeholder="customer@email.com" 
                            {...field}
                            data-testid="input-customer-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel"
                            placeholder="+1 (555) 123-4567" 
                            {...field}
                            data-testid="input-customer-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Customer address" 
                            {...field}
                            data-testid="input-customer-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-foreground">Invoice Items</h4>
                  <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
                    <DialogTrigger asChild>
                      <Button type="button" data-testid="button-add-product">
                        <i className="fas fa-plus mr-2"></i>
                        Add Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>Select Products</DialogTitle>
                      </DialogHeader>
                      <div className="max-h-96 overflow-y-auto">
                        {(productsData as any)?.products?.length ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(productsData as any).products.map((product: any) => (
                              <Card 
                                key={product.id} 
                                className={`cursor-pointer transition-colors ${
                                  selectedProducts.has(product.id) ? 'bg-muted' : 'hover:bg-muted'
                                }`}
                                onClick={() => addProductToInvoice(product)}
                                data-testid={`product-option-${product.id}`}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center">
                                      {product.imageUrl ? (
                                        <img 
                                          src={product.imageUrl} 
                                          alt={product.productName} 
                                          className="w-12 h-12 rounded-md object-cover"
                                        />
                                      ) : (
                                        <i className="fas fa-image text-muted-foreground"></i>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <h5 className="font-medium text-foreground">{product.productName}</h5>
                                      <p className="text-sm text-muted-foreground">
                                        {product.productId} • Size: {product.size} • {formatCurrency(product.price)}
                                      </p>
                                      <Badge variant="secondary">{product.quantity} in stock</Badge>
                                    </div>
                                    {selectedProducts.has(product.id) && (
                                      <i className="fas fa-check text-accent"></i>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <i className="fas fa-box text-muted-foreground text-3xl mb-4"></i>
                            <p className="text-sm text-muted-foreground">No products available</p>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Invoice Items Table */}
                <div className="bg-background border border-input rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Size</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {invoiceItems.length > 0 ? (
                        invoiceItems.map((item, index) => (
                          <tr key={index} data-testid={`invoice-item-${index}`}>
                            <td className="px-4 py-3 text-sm text-foreground">{item.product.productName}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.product.size}</td>
                            <td className="px-4 py-3">
                              <Input
                                type="number"
                                value={item.quantity}
                                min="1"
                                className="w-16"
                                onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 1)}
                                data-testid={`input-quantity-${index}`}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-4 py-3 text-sm font-medium text-foreground">{formatCurrency(item.totalPrice)}</td>
                            <td className="px-4 py-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                data-testid={`button-remove-${index}`}
                              >
                                <i className="fas fa-trash w-4 h-4 text-destructive"></i>
                              </Button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                            No items added. Click "Add Product" to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Invoice Totals */}
                {invoiceItems.length > 0 && (
                  <div className="bg-muted rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-start">
                      <div className="w-1/2 space-y-4">
                        {/* Discount Percentage Input */}
                        <FormField
                          control={form.control}
                          name="discountPercentage"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discount Percentage (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  placeholder="0.0" 
                                  {...field}
                                  data-testid="input-discount"
                                  className="w-32"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Tax Rate Input */}
                        <FormField
                          control={form.control}
                          name="taxRate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tax Rate (%)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="50"
                                  step="0.1"
                                  placeholder="8.5" 
                                  {...field}
                                  data-testid="input-tax-rate"
                                  className="w-32"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="text-foreground font-medium" data-testid="text-subtotal">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                        {parseFloat(form.watch("discountPercentage") || "0") > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Discount ({form.watch("discountPercentage")}%):</span>
                            <span className="text-destructive font-medium" data-testid="text-discount">
                              -{formatCurrency(discountAmount)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax ({form.watch("taxRate") || "8.5"}%):</span>
                          <span className="text-foreground font-medium" data-testid="text-tax">
                            {formatCurrency(taxAmount)}
                          </span>
                        </div>
                        <div className="border-t border-border pt-2">
                          <div className="flex justify-between text-base font-semibold">
                            <span className="text-foreground">Total:</span>
                            <span className="text-foreground" data-testid="text-total">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Additional Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        rows={3}
                        placeholder="Add any additional notes..." 
                        className="resize-none"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Form Actions */}
              <div className="flex items-center justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => navigate("/invoices")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createInvoiceMutation.isPending}
                  data-testid="button-create-invoice"
                >
                  <i className="fas fa-save mr-2"></i>
                  {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
