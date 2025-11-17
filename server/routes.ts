import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupCustomAuth, isAuthenticated, hashPassword } from "./customAuth";
import passport from "passport";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertProductSchema, insertInvoiceSchema, insertInvoiceItemSchema, insertActivityLogSchema } from "@shared/schema";
import { z } from "zod";
import QRCode from "qrcode";
import { randomUUID, randomBytes, createHash } from "crypto";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import multer from "multer";

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
    const userId = req.user?.id;
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
    
    // Add discount if present
    if (invoice.discountAmount && parseFloat(invoice.discountAmount) > 0) {
      yPosition += 15;
      doc.text(`Discount: -$${parseFloat(invoice.discountAmount).toFixed(2)}`, 400, yPosition);
    }
    
    yPosition += 15;
    doc.fontSize(14).text(`Total: $${parseFloat(invoice.total).toFixed(2)}`, 400, yPosition);
    
    if (invoice.notes) {
      yPosition += 40;
      doc.fontSize(12).text('Notes:', 50, yPosition);
      doc.text(invoice.notes, 50, yPosition + 15);
      yPosition += 50;
    } else {
      yPosition += 40;
    }
    
    // Enhanced Company footer with better formatting
    yPosition += 20;
    
    // Add a separator line
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 15;
    
    // Company name - larger and bold
    doc.fontSize(12).text('Volume Fashion Collection', 50, yPosition, { align: 'left' });
    yPosition += 20;
    
    // Address with better formatting
    doc.fontSize(9);
    doc.text('Address:', 50, yPosition);
    doc.text('4006-4008 Room, 5th Floor, Changjiang International Garment Building', 50, yPosition + 12);
    doc.text('No.931, Renmingbei Road, Yuexiu District, Guangzhou, China', 50, yPosition + 24);
    
    // Contact info
    doc.text('Contact:', 300, yPosition);
    doc.text('Tel: +86 132 8868 9165', 300, yPosition + 12);
    doc.text('Email: info@volumefashion.com', 300, yPosition + 24);
    
    // Thank you message
    yPosition += 50;
    doc.fontSize(10).text('Thank you for your business!', 50, yPosition, { align: 'center', width: 500 });
    
    doc.end();
  });
};

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupCustomAuth(app);

  // This endpoint is used to serve public assets.
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Auth routes
  app.post('/api/auth/login', (req, res, next) => {
    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({ message: "Login successful", user: { id: user.id, username: user.username, role: user.role } });
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Password reset routes
  app.post('/api/auth/password/forgot', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Always return success to prevent user enumeration
      const genericMessage = "If an account with that email exists, you will receive a password reset link.";
      
      const user = await storage.getUserByEmail(email);
      if (user) {
        // Generate secure token
        const token = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        // Store token hash
        await storage.createPasswordResetToken(user.id, tokenHash, expiresAt);
        
        // Send email
        const transporter = createEmailTransporter();
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;
        
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'noreply@volumefashion.com',
          to: email,
          subject: 'Volume Fashion - Password Reset Request',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your Volume Fashion account.</p>
            <p>Click the link below to reset your password:</p>
            <p><a href="${resetLink}" style="color: #007bff; text-decoration: none;">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards,<br>Volume Fashion Team</p>
          `
        });
      }
      
      res.json({ message: genericMessage });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post('/api/auth/password/validate', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const resetToken = await storage.findValidPasswordResetTokenByHash(tokenHash);
      
      if (resetToken) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false });
      }
    } catch (error) {
      console.error("Token validation error:", error);
      res.status(500).json({ message: "Failed to validate token" });
    }
  });

  app.post('/api/auth/password/reset', async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }

      const tokenHash = createHash('sha256').update(token).digest('hex');
      const resetToken = await storage.findValidPasswordResetTokenByHash(tokenHash);
      
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      
      // Mark token as used
      await storage.markPasswordResetTokenUsed(resetToken.id);
      
      res.json({ message: "Password reset successful" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get('/api/auth/user', (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(req.user);
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

  // Manufacturer statistics
  app.get("/api/reports/manufacturers", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate, range } = req.query;
      const manufacturerStats = await storage.getManufacturerStats({
        startDate: startDate as string,
        endDate: endDate as string,
        range: range as string
      });
      res.json(manufacturerStats);
    } catch (error) {
      console.error("Error fetching manufacturer statistics:", error);
      res.status(500).json({ message: "Failed to fetch manufacturer statistics" });
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

  // More specific routes must come before generic ones
  app.get("/api/products/by-product-id/:productId", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProductByProductId(req.params.productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product by productId:", error);
      res.status(500).json({ message: "Failed to fetch product" });
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
        createdBy: req.user.id
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

  // Bulk upload products from CSV
  app.post("/api/products/bulk-upload", isAuthenticated, upload.single('csvFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No CSV file provided" });
      }

      const csvData = req.file.buffer.toString('utf8');
      const lines = csvData.split('\n').filter((line: string) => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV file must contain header and at least one product row" });
      }

      // Parse CSV headers
      const headers = lines[0].split(',').map((h: string) => h.trim().replace(/"/g, ''));
      const expectedHeaders = ['Product ID', 'Product Name', 'Color', 'Size', 'Quantity', 'Price', 'Category', 'Description'];
      
      // Check if required headers exist
      const requiredHeaders = ['Product ID', 'Product Name', 'Color', 'Size', 'Quantity', 'Price'];
      const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
      
      if (missingHeaders.length > 0) {
        return res.status(400).json({ 
          message: `Missing required headers: ${missingHeaders.join(', ')}` 
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each product row
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map((v: string) => v.trim().replace(/"/g, ''));
          
          if (values.length < headers.length) {
            errors.push(`Row ${i}: Insufficient columns`);
            errorCount++;
            continue;
          }

          const productData: any = {};
          headers.forEach((header: string, index: number) => {
            const value = values[index] || '';
            switch (header) {
              case 'Product ID':
                productData.productId = value;
                break;
              case 'Product Name':
                productData.productName = value;
                break;
              case 'Color':
                productData.color = value;
                break;
              case 'Size':
                productData.size = value;
                break;
              case 'Quantity':
                productData.quantity = parseInt(value) || 0;
                break;
              case 'Price':
                productData.price = value; // Keep as string for decimal type
                break;
              case 'Category':
                productData.category = value || null;
                break;
              case 'Description':
                productData.description = value || null;
                break;
            }
          });

          // Validate required fields
          if (!productData.productId || !productData.productName || !productData.color || !productData.size || !productData.price) {
            errors.push(`Row ${i}: Missing required fields`);
            errorCount++;
            continue;
          }

          // Validate price is a valid number
          if (isNaN(parseFloat(productData.price))) {
            errors.push(`Row ${i}: Invalid price value`);
            errorCount++;
            continue;
          }

          // Check if product ID already exists
          const existingProduct = await storage.getProductByProductId(productData.productId);
          if (existingProduct) {
            errors.push(`Row ${i}: Product ID ${productData.productId} already exists`);
            errorCount++;
            continue;
          }

          // Validate with schema
          const validatedProduct = insertProductSchema.parse(productData);
          
          // Create product
          const product = await storage.createProduct({
            ...validatedProduct,
            imageUrl: null, // No image for bulk upload initially
          });

          await storage.createActivityLog({
            userId: req.user.id,
            action: 'create',
            module: 'product',
            targetId: product.id,
            targetName: product.productName,
            details: { message: `Bulk uploaded product: ${product.productName}` },
          });

          successCount++;

        } catch (error) {
          console.error(`Error processing row ${i}:`, error);
          errors.push(`Row ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          errorCount++;
        }
      }

      res.json({
        message: `Bulk upload completed`,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // Return first 10 errors only
      });

    } catch (error) {
      console.error("Error in bulk upload:", error);
      res.status(500).json({ message: "Failed to process bulk upload" });
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
        insertProductSchema.parse({ ...p, createdBy: req.user.id })
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
      const { page = "1", limit = "20", status, startDate, endDate, customerName } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const result = await storage.getAllInvoices({
        limit: parseInt(limit as string),
        offset,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        customerName: customerName as string
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
        createdBy: req.user.id
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
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Normalize status for case-insensitive comparisons
      const normalizedStatus = status?.toLowerCase();
      
      // Only allow Pending and Processed statuses through this route
      // Deleted status can only be set through the DELETE route
      if (!['pending', 'processed'].includes(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status. Only 'Pending' and 'Processed' are allowed" });
      }
      
      // Check if invoice exists and is not deleted
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot modify deleted invoices" });
      }
      
      // Only Admin/Manager can process invoices
      if (normalizedStatus === 'processed' && !['Admin', 'Manager'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Insufficient permissions to process invoices" });
      }
      
      // Use the properly capitalized status for storage
      const capitalizedStatus = normalizedStatus === 'pending' ? 'Pending' : 'Processed';
      const updatedInvoice = await storage.updateInvoiceStatus(req.params.id, capitalizedStatus, userId);
      
      await logActivity(req, `Updated invoice ${updatedInvoice.invoiceNumber} status to ${capitalizedStatus}`, 'Invoices', updatedInvoice.id, updatedInvoice.invoiceNumber);
      
      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  app.delete("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only Admin can delete invoices
      if (!['Admin'].includes(user?.role || '')) {
        return res.status(403).json({ message: "Only admins can delete invoices" });
      }
      
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      // Check if invoice is already deleted
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(409).json({ message: "Invoice is already deleted" });
      }
      
      // Mark invoice as deleted
      const deletedInvoice = await storage.updateInvoiceStatus(req.params.id, 'Deleted', userId);
      
      await logActivity(req, `Deleted invoice ${invoice.invoiceNumber}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json({ message: "Invoice marked as deleted", invoice: deletedInvoice });
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  app.put("/api/invoices/:id/discount", isAuthenticated, async (req: any, res) => {
    try {
      // Check if invoice exists and is not deleted
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot modify deleted invoices" });
      }
      
      const { discountAmount } = req.body;
      
      // Validate discount amount
      const discountSchema = z.object({
        discountAmount: z.number().min(0)
      });
      
      const { discountAmount: validatedDiscount } = discountSchema.parse({ discountAmount });
      
      const updatedInvoice = await storage.updateInvoiceDiscount(req.params.id, validatedDiscount);
      
      await logActivity(req, `Updated invoice ${updatedInvoice.invoiceNumber} discount to $${validatedDiscount.toFixed(2)}`, 'Invoices', updatedInvoice.id, updatedInvoice.invoiceNumber);
      
      res.json(updatedInvoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid discount amount", errors: error.errors });
      }
      console.error("Error updating invoice discount:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update invoice discount" });
    }
  });

  app.post("/api/invoices/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      // Check that invoice exists and is pending (not processed or deleted)
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot modify deleted invoices" });
      }
      if (invoice.status?.toLowerCase() !== 'pending') {
        return res.status(403).json({ message: "Can only add items to pending invoices" });
      }

      const { productId, quantity, unitPrice } = req.body;
      
      const itemSchema = z.object({
        productId: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0)
      });
      
      const validatedItem = itemSchema.parse({ productId, quantity, unitPrice });
      const totalPrice = validatedItem.unitPrice * validatedItem.quantity;
      
      const newItem = await storage.addInvoiceItem(req.params.id, {
        productId: validatedItem.productId,
        quantity: validatedItem.quantity,
        unitPrice: validatedItem.unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2)
      });
      
      await logActivity(req, `Added item to invoice ${invoice.invoiceNumber}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json(newItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      console.error("Error adding invoice item:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to add invoice item" });
    }
  });

  app.put("/api/invoices/:invoiceId/items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      // Check that invoice exists and is pending (not processed or deleted)
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot modify deleted invoices" });
      }
      if (invoice.status?.toLowerCase() !== 'pending') {
        return res.status(403).json({ message: "Can only update items in pending invoices" });
      }

      const { quantity } = req.body;
      
      const quantitySchema = z.object({
        quantity: z.number().min(1)
      });
      
      const { quantity: validatedQuantity } = quantitySchema.parse({ quantity });
      
      const updatedItem = await storage.updateInvoiceItemQuantity(req.params.itemId, validatedQuantity);
      
      await logActivity(req, `Updated item quantity in invoice ${invoice.invoiceNumber}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid quantity", errors: error.errors });
      }
      console.error("Error updating invoice item:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to update invoice item" });
    }
  });

  app.delete("/api/invoices/:invoiceId/items/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      // Check that invoice exists and is pending (not processed or deleted)
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot modify deleted invoices" });
      }
      if (invoice.status?.toLowerCase() !== 'pending') {
        return res.status(403).json({ message: "Can only delete items from pending invoices" });
      }

      await storage.deleteInvoiceItem(req.params.itemId);
      
      await logActivity(req, `Deleted item from invoice ${invoice.invoiceNumber}`, 'Invoices', invoice.id, invoice.invoiceNumber);
      
      res.json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting invoice item:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to delete invoice item" });
    }
  });

  app.post("/api/invoices/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoiceWithItems(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot generate PDF for deleted invoices" });
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
      
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot email deleted invoices" });
      }
      
      if (invoice.status !== 'Processed') {
        return res.status(400).json({ message: "Can only email processed invoices" });
      }
      
      if (!invoice.customerEmail) {
        return res.status(400).json({ message: "Customer email is required to send invoice" });
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
      
      if (invoice.status?.toLowerCase() === 'deleted') {
        return res.status(403).json({ message: "Cannot send deleted invoices via WhatsApp" });
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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

  app.post("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const currentUser = await storage.getUser(userId);
      
      if (currentUser?.role !== 'Admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { email, firstName, lastName, role, username, password } = req.body;
      const user = await storage.upsertUser({
        username: username || email, // Use username or fallback to email
        password: password || 'defaultPassword123', // Temporary password
        email,
        firstName,
        lastName,
        role: role || 'Viewer',
        isActive: true
      });
      
      await logActivity(req, `Created user account for ${email}`, 'Users', user.id, email);
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
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
