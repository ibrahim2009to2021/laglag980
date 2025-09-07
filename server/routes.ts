import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertProductSchema, insertInvoiceSchema, insertInvoiceItemSchema, insertActivityLogSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";

// QR Code upload function
const uploadQRCodeToStorage = async (productId: string, qrCodeBuffer: Buffer): Promise<string> => {
  try {
    const publicSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',') || [];
    if (publicSearchPaths.length === 0) {
      throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not configured");
    }
    
    // Use the first public path for QR codes
    const publicPath = publicSearchPaths[0].trim();
    const { bucketName, objectName: basePath } = parseObjectPath(publicPath);
    
    const qrCodeFileName = `qr-codes/${productId}.png`;
    const fullObjectPath = basePath ? `${basePath}/${qrCodeFileName}` : qrCodeFileName;
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(fullObjectPath);
    
    // Upload the QR code buffer
    await file.save(qrCodeBuffer, {
      metadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=3600',
      },
    });
    
    // Return the public URL
    return `/public-objects/${qrCodeFileName}`;
  } catch (error) {
    console.error("Error uploading QR code to storage:", error);
    throw error;
  }
};

const parseObjectPath = (path: string): { bucketName: string; objectName: string } => {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 2) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
};

// Email configuration
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || process.env.GMAIL_USER || 'default@gmail.com',
      pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS || 'defaultpass'
    }
  });
};

// WhatsApp integration (using Twilio)
const sendWhatsAppMessage = async (to: string, pdfUrl: string) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID || 'default_sid';
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN || 'default_token';
  const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
  
  const client = require('twilio')(accountSid, authToken);
  
  try {
    await client.messages.create({
      body: `Your invoice is ready! Download it here: ${pdfUrl}`,
      from: twilioNumber,
      to: `whatsapp:${to}`
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    throw new Error('Failed to send WhatsApp message');
  }
};

// Activity logging helper
const logActivity = async (req: any, action: string, module: string, targetId?: string, targetName?: string, details?: any) => {
  try {
    const userId = req.user?.claims?.sub;
    await storage.createActivityLog({
      userId,
      action,
      module,
      targetId,
      targetName,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

// PDF generation
const generateInvoicePDF = async (invoice: any, items: any[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const buffers: Buffer[] = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    
    // Header
    doc.fontSize(20).text('INVOICE', 50, 50);
    doc.fontSize(12).text(`Invoice #: ${invoice.invoiceNumber}`, 50, 80);
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 50, 95);
    
    // Customer info
    doc.text('Bill To:', 50, 130);
    doc.text(invoice.customerName, 50, 145);
    doc.text(invoice.customerEmail, 50, 160);
    if (invoice.customerPhone) doc.text(invoice.customerPhone, 50, 175);
    if (invoice.customerAddress) doc.text(invoice.customerAddress, 50, 190);
    
    // Items table header
    const tableTop = 230;
    doc.text('Product', 50, tableTop);
    doc.text('Size', 200, tableTop);
    doc.text('Qty', 300, tableTop);
    doc.text('Price', 400, tableTop);
    doc.text('Total', 480, tableTop);
    
    // Items
    let yPosition = tableTop + 20;
    items.forEach((item) => {
      doc.text(item.product.productName, 50, yPosition);
      doc.text(item.product.size, 200, yPosition);
      doc.text(item.quantity.toString(), 300, yPosition);
      doc.text(`$${parseFloat(item.unitPrice).toFixed(2)}`, 400, yPosition);
      doc.text(`$${parseFloat(item.totalPrice).toFixed(2)}`, 480, yPosition);
      yPosition += 20;
    });
    
    // Totals
    yPosition += 20;
    doc.text(`Subtotal: $${parseFloat(invoice.subtotal).toFixed(2)}`, 400, yPosition);
    yPosition += 15;
    doc.text(`Tax: $${parseFloat(invoice.taxAmount).toFixed(2)}`, 400, yPosition);
    yPosition += 15;
    doc.fontSize(14).text(`Total: $${parseFloat(invoice.total).toFixed(2)}`, 400, yPosition);
    
    if (invoice.notes) {
      yPosition += 40;
      doc.fontSize(12).text('Notes:', 50, yPosition);
      doc.text(invoice.notes, 50, yPosition + 15);
    }
    
    doc.end();
  });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user) {
        await storage.updateUserLastLogin(userId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Object storage routes for product images
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Dashboard metrics
  app.get("/api/dashboard/metrics", isAuthenticated, async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  // Product routes
  app.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const { page = "1", limit = "20", search, category, size, stockLevel } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const result = await storage.getAllProducts({
        limit: parseInt(limit as string),
        offset,
        search: search as string,
        category: category as string,
        size: size as string,
        stockLevel: stockLevel as string
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const validatedProduct = insertProductSchema.parse({
        ...req.body,
        createdBy: req.user.claims.sub
      });
      
      // Check for duplicate product ID
      const existingProduct = await storage.getProductByProductId(validatedProduct.productId);
      if (existingProduct) {
        return res.status(400).json({ message: "Product ID already exists" });
      }
      
      const product = await storage.createProduct(validatedProduct);
      
      // Generate QR code for all products and store as image file
      try {
        const qrCodeData = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/products/${product.id}`;
        const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
          type: 'png',
          width: 300,
          margin: 2,
        });
        
        // Upload QR code to object storage
        const qrCodeUrl = await uploadQRCodeToStorage(product.id, qrCodeBuffer);
        await storage.updateProductQRCode(product.id, qrCodeUrl);
      } catch (qrError) {
        console.error("Error generating QR code:", qrError);
      }
      
      await logActivity(req, `Created product "${product.productName}"`, 'Products', product.id, product.productName);
      
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const productId = req.params.id;
      const updates = insertProductSchema.partial().parse(req.body);
      
      const product = await storage.updateProduct(productId, updates);
      
      await logActivity(req, `Updated product "${product.productName}"`, 'Products', product.id, product.productName);
      
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      await storage.deleteProduct(req.params.id);
      
      await logActivity(req, `Deleted product "${product.productName}"`, 'Products', product.id, product.productName);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.post("/api/products/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const { products: productData } = req.body;
      
      if (!Array.isArray(productData) || productData.length === 0) {
        return res.status(400).json({ message: "Invalid product data" });
      }
      
      const validatedProducts = productData.map(p => 
        insertProductSchema.parse({ ...p, createdBy: req.user.claims.sub })
      );
      
      // Check for duplicate product IDs
      const duplicates = [];
      const uniqueProducts = [];
      
      for (const product of validatedProducts) {
        const existing = await storage.getProductByProductId(product.productId);
        if (existing) {
          duplicates.push(product.productId);
        } else {
          uniqueProducts.push(product);
        }
      }
      
      const createdProducts = uniqueProducts.length > 0 
        ? await storage.createBulkProducts(uniqueProducts)
        : [];
      
      await logActivity(req, `Bulk imported ${createdProducts.length} products`, 'Products', undefined, undefined, {
        imported: createdProducts.length,
        duplicates: duplicates.length
      });
      
      res.json({
        imported: createdProducts.length,
        duplicates,
        products: createdProducts
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      console.error("Error bulk importing products:", error);
      res.status(500).json({ message: "Failed to import products" });
    }
  });

  app.put("/api/products/:id/image", isAuthenticated, async (req: any, res) => {
    try {
      const productId = req.params.id;
      const { imageUrl } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ message: "Image URL is required" });
      }
      
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(imageUrl);
      
      await storage.updateProduct(productId, { imageUrl: normalizedPath });
      
      // Generate QR code and store as image file
      const qrCodeData = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/products/${productId}`;
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeData, {
        type: 'png',
        width: 300,
        margin: 2,
      });
      
      // Upload QR code to object storage
      const qrCodeUrl = await uploadQRCodeToStorage(productId, qrCodeBuffer);
      const updatedProduct = await storage.updateProductQRCode(productId, qrCodeUrl);
      
      await logActivity(req, `Updated image for product "${updatedProduct.productName}"`, 'Products', productId, updatedProduct.productName);
      
      res.json({ product: updatedProduct });
    } catch (error) {
      console.error("Error updating product image:", error);
      res.status(500).json({ message: "Failed to update product image" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const { page = "1", limit = "20", status, startDate, endDate } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const result = await storage.getAllInvoices({
        limit: parseInt(limit as string),
        offset,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const invoice = await storage.getInvoiceWithItems(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const { invoice: invoiceData, items: itemsData } = req.body;
      
      const validatedInvoice = insertInvoiceSchema.parse({
        ...invoiceData,
        createdBy: req.user.claims.sub
      });
      
      const validatedItems = itemsData.map((item: any) => 
        insertInvoiceItemSchema.parse(item)
      );
      
      const invoice = await storage.createInvoice(validatedInvoice, validatedItems);
      
      await logActivity(req, `Created invoice ${invoice.invoiceNumber}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invoice data", errors: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.put("/api/invoices/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const { status } = req.body;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only Admin/Manager can process invoices
      if (status === 'Processed' && !['Admin', 'Manager'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Insufficient permissions to process invoices" });
      }
      
      const invoice = await storage.updateInvoiceStatus(req.params.id, status, userId);
      
      await logActivity(req, `Updated invoice ${invoice.invoiceNumber} status to ${status}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  app.post("/api/invoices/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceWithItems(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (invoice.status !== 'Processed') {
        return res.status(400).json({ message: "Can only generate PDF for processed invoices" });
      }
      
      const pdfBuffer = await generateInvoicePDF(invoice, invoice.items);
      
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.post("/api/invoices/:id/email", isAuthenticated, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceWithItems(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (invoice.status !== 'Processed') {
        return res.status(400).json({ message: "Can only email processed invoices" });
      }
      
      const pdfBuffer = await generateInvoicePDF(invoice, invoice.items);
      
      const transporter = createEmailTransporter();
      
      await transporter.sendMail({
        from: process.env.EMAIL_USER || 'noreply@fashionhub.com',
        to: invoice.customerEmail,
        subject: `Invoice ${invoice.invoiceNumber} - FashionHub`,
        html: `
          <h2>Your Invoice is Ready</h2>
          <p>Dear ${invoice.customerName},</p>
          <p>Please find your invoice ${invoice.invoiceNumber} attached.</p>
          <p>Total Amount: $${parseFloat(invoice.total).toFixed(2)}</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br>FashionHub Team</p>
        `,
        attachments: [
          {
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      });
      
      await logActivity(req, `Sent invoice ${invoice.invoiceNumber} via email to ${invoice.customerEmail}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  app.post("/api/invoices/:id/whatsapp", isAuthenticated, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceWithItems(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (invoice.status !== 'Processed') {
        return res.status(400).json({ message: "Can only send processed invoices via WhatsApp" });
      }
      
      if (!invoice.customerPhone) {
        return res.status(400).json({ message: "Customer phone number is required for WhatsApp" });
      }
      
      // For demo purposes, create a download link
      const pdfUrl = `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/api/invoices/${invoice.id}/pdf`;
      
      await sendWhatsAppMessage(invoice.customerPhone, pdfUrl);
      
      await logActivity(req, `Sent invoice ${invoice.invoiceNumber} via WhatsApp to ${invoice.customerPhone}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json({ message: "WhatsApp message sent successfully" });
    } catch (error) {
      console.error("Error sending WhatsApp:", error);
      res.status(500).json({ message: "Failed to send WhatsApp message" });
    }
  });

  // User management routes (Admin only)
  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'Admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'Admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { role } = req.body;
      const user = await storage.updateUserRole(req.params.id, role);
      
      await logActivity(req, `Updated user ${user?.email} role to ${role}`, 'Users', user?.id || undefined, user?.email || undefined);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  app.put("/api/users/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'Admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { isActive } = req.body;
      const user = await storage.updateUserStatus(req.params.id, isActive);
      
      await logActivity(req, `${isActive ? 'Activated' : 'Deactivated'} user ${user?.email}`, 'Users', user?.id || undefined, user?.email || undefined);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Activity logs
  app.get("/api/activity-logs", isAuthenticated, async (req, res) => {
    try {
      const { page = "1", limit = "50", userId, module, startDate, endDate } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const result = await storage.getActivityLogs({
        limit: parseInt(limit as string),
        offset,
        userId: userId as string,
        module: module as string,
        startDate: startDate as string,
        endDate: endDate as string
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ message: "Failed to fetch activity logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
