import {
  users,
  products,
  invoices,
  invoiceItems,
  activityLogs,
  passwordResetTokens,
  type User,
  type UpsertUser,
  type InsertProduct,
  type Product,
  type InsertInvoice,
  type Invoice,
  type InsertInvoiceItem,
  type InvoiceItem,
  type InsertActivityLog,
  type ActivityLog,
  type InsertPasswordResetToken,
  type PasswordResetToken,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, count, sql, isNull, gt } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserStatus(id: string, isActive: boolean): Promise<User>;

  // Password reset operations
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetToken>;
  findValidPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(tokenId: string): Promise<void>;

  // Product operations
  createProduct(product: InsertProduct): Promise<Product>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByProductId(productId: string): Promise<Product | undefined>;
  getAllProducts(options?: { limit?: number; offset?: number; search?: string; category?: string; size?: string; stockLevel?: string }): Promise<{ products: Product[]; total: number }>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  updateProductQRCode(id: string, qrCodeUrl: string): Promise<Product>;
  createBulkProducts(products: InsertProduct[]): Promise<Product[]>;
  getLowStockProducts(threshold?: number): Promise<Product[]>;

  // Invoice operations
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getAllInvoices(options?: { limit?: number; offset?: number; status?: string; startDate?: string; endDate?: string; customerName?: string }): Promise<{ invoices: Invoice[]; total: number }>;
  updateInvoiceStatus(id: string, status: string, processedBy?: string): Promise<Invoice>;
  updateInvoicePdfPath(id: string, pdfPath: string): Promise<Invoice>;
  getInvoiceItems(invoiceId: string): Promise<(InvoiceItem & { product: Product })[]>;
  getInvoiceWithItems(id: string): Promise<(Invoice & { items: (InvoiceItem & { product: Product })[] }) | undefined>;
  updateInvoiceDiscount(id: string, discountAmount: number): Promise<Invoice>;
  addInvoiceItem(invoiceId: string, item: InsertInvoiceItem): Promise<InvoiceItem>;
  updateInvoiceItemQuantity(invoiceItemId: string, quantity: number): Promise<InvoiceItem>;
  deleteInvoiceItem(invoiceItemId: string): Promise<void>;
  recalculateInvoiceTotals(invoiceId: string): Promise<Invoice>;

  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(options?: { limit?: number; offset?: number; userId?: string; module?: string; startDate?: string; endDate?: string }): Promise<{ logs: (ActivityLog & { user: User | null })[];  total: number }>;

  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    pendingInvoices: number;
    monthlyRevenue: number;
  }>;

  // Manufacturer statistics
  getManufacturerStats(): Promise<{
    manufacturer: string;
    totalQuantitySold: number;
    totalRevenue: number;
    productCount: number;
  }[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: passwordHash, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Password reset operations
  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetToken> {
    const [token] = await db
      .insert(passwordResetTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    return token;
  }

  async findValidPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const [token] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      );
    return token;
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenId));
  }

  // Product operations
  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async getProductByProductId(productId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.productId, productId));
    return product;
  }

  async getAllProducts(options?: { limit?: number; offset?: number; search?: string; category?: string; size?: string; stockLevel?: string }): Promise<{ products: Product[]; total: number }> {
    const { limit = 50, offset = 0, search, category, size, stockLevel } = options || {};
    
    const conditions = [eq(products.isActive, true)];
    
    if (search) {
      conditions.push(ilike(products.productName, `%${search}%`));
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (size) {
      // Size is now an array, so we need to check if it contains the size
      conditions.push(sql`${size} = ANY(${products.size})`);
    }
    if (stockLevel === 'low') {
      conditions.push(sql`${products.quantity} <= 5`);
    } else if (stockLevel === 'out') {
      conditions.push(eq(products.quantity, 0));
    } else if (stockLevel === 'in') {
      conditions.push(sql`${products.quantity} > 5`);
    }
    
    const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
    
    const [productsResult, totalResult] = await Promise.all([
      db.select().from(products)
        .where(whereCondition)
        .orderBy(desc(products.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(products).where(whereCondition)
    ]);
    
    return {
      products: productsResult,
      total: totalResult[0].count
    };
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  async updateProductQRCode(id: string, qrCodeUrl: string): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ qrCodeUrl, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async createBulkProducts(productList: InsertProduct[]): Promise<Product[]> {
    return await db.insert(products).values(productList).returning();
  }

  async getLowStockProducts(threshold: number = 5): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(and(
        eq(products.isActive, true),
        sql`${products.quantity} <= ${threshold}`
      ))
      .orderBy(products.quantity);
  }

  // Invoice operations
  async createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      // Generate invoice number
      const invoiceCount = await tx.select({ count: count() }).from(invoices);
      const invoiceNumber = `INV-${String(invoiceCount[0].count + 1).padStart(4, '0')}`;
      
      const [newInvoice] = await tx
        .insert(invoices)
        .values({ ...invoice, invoiceNumber })
        .returning();
      
      const invoiceItemsWithId = items.map(item => ({
        ...item,
        invoiceId: newInvoice.id
      }));
      
      await tx.insert(invoiceItems).values(invoiceItemsWithId);
      
      return newInvoice;
    });
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getAllInvoices(options?: { limit?: number; offset?: number; status?: string; startDate?: string; endDate?: string; customerName?: string }): Promise<{ invoices: Invoice[]; total: number }> {
    const { limit = 50, offset = 0, status, startDate, endDate, customerName } = options || {};
    
    const conditions = [];
    
    // Always exclude deleted invoices from the main list
    conditions.push(sql`LOWER(${invoices.status}) != 'deleted'`);
    
    if (status) {
      conditions.push(eq(invoices.status, status as any));
    }
    if (startDate) {
      conditions.push(sql`${invoices.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${invoices.createdAt} <= ${endDate}`);
    }
    if (customerName) {
      conditions.push(ilike(invoices.customerName, `%${customerName}%`));
    }
    
    const whereCondition = conditions.length > 0 
      ? (conditions.length === 1 ? conditions[0] : and(...conditions))
      : undefined;
    
    const [invoicesResult, totalResult] = await Promise.all([
      whereCondition
        ? db.select().from(invoices)
            .where(whereCondition)
            .orderBy(desc(invoices.createdAt))
            .limit(limit)
            .offset(offset)
        : db.select().from(invoices)
            .orderBy(desc(invoices.createdAt))
            .limit(limit)
            .offset(offset),
      whereCondition
        ? db.select({ count: count() }).from(invoices).where(whereCondition)
        : db.select({ count: count() }).from(invoices)
    ]);
    
    return {
      invoices: invoicesResult,
      total: totalResult[0].count
    };
  }

  async updateInvoiceStatus(id: string, status: string, processedBy?: string): Promise<Invoice> {
    return await db.transaction(async (tx) => {
      const updateData: any = { status, updatedAt: new Date() };
      if (status === 'Processed' && processedBy) {
        updateData.processedBy = processedBy;
        updateData.processedAt = new Date();
      }
      
      // Update invoice status
      const [invoice] = await tx
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, id))
        .returning();
      
      // If processing the invoice, deduct inventory quantities
      if (status === 'Processed') {
        // Get invoice items
        const items = await tx
          .select()
          .from(invoiceItems)
          .where(eq(invoiceItems.invoiceId, id));
        
        // Deduct inventory for each item
        for (const item of items) {
          // Get current product quantity first
          const [currentProduct] = await tx
            .select({ quantity: products.quantity })
            .from(products)
            .where(eq(products.id, item.productId));
          
          const newQuantity = (currentProduct?.quantity || 0) - item.quantity;
          
          await tx
            .update(products)
            .set({ 
              quantity: newQuantity,
              updatedAt: new Date()
            })
            .where(eq(products.id, item.productId));
        }
      }
      
      return invoice;
    });
  }

  async updateInvoicePdfPath(id: string, pdfPath: string): Promise<Invoice> {
    const [invoice] = await db
      .update(invoices)
      .set({ pdfPath, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
  }

  async getInvoiceItems(invoiceId: string): Promise<(InvoiceItem & { product: Product })[]> {
    const result = await db
      .select()
      .from(invoiceItems)
      .leftJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, invoiceId));
    
    return result.map(row => ({
      ...row.invoice_items,
      product: row.products!
    }));
  }

  async getInvoiceWithItems(id: string): Promise<(Invoice & { items: (InvoiceItem & { product: Product })[] }) | undefined> {
    const invoice = await this.getInvoice(id);
    if (!invoice) return undefined;
    
    const items = await this.getInvoiceItems(id);
    
    return {
      ...invoice,
      items
    };
  }

  async updateInvoiceDiscount(id: string, discountAmount: number): Promise<Invoice> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    if (invoice.status !== 'Pending') {
      throw new Error('Can only update discount for pending invoices');
    }
    
    // Calculate new values based on discount amount (no tax)
    const subtotal = parseFloat(invoice.subtotal);
    const total = subtotal - discountAmount;
    
    // Calculate percentage for reference (optional, can be removed if not needed)
    const discountPercentage = subtotal > 0 ? (discountAmount / subtotal) : 0;
    
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        discountPercentage: discountPercentage.toFixed(4),
        discountAmount: discountAmount.toFixed(2),
        taxAmount: "0.00",
        total: total.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, id))
      .returning();
    
    return updatedInvoice;
  }

  async addInvoiceItem(invoiceId: string, item: InsertInvoiceItem): Promise<InvoiceItem> {
    // First check that the invoice exists and is pending
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'Pending') {
      throw new Error('Can only add items to pending invoices');
    }

    // Insert the new item
    const [newItem] = await db
      .insert(invoiceItems)
      .values({ ...item, invoiceId })
      .returning();

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(invoiceId);

    return newItem;
  }

  async updateInvoiceItemQuantity(invoiceItemId: string, quantity: number): Promise<InvoiceItem> {
    // Get the invoice item
    const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, invoiceItemId));
    if (!item) {
      throw new Error('Invoice item not found');
    }

    // Check that the invoice is pending
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, item.invoiceId));
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'Pending') {
      throw new Error('Can only update items in pending invoices');
    }

    // Update the quantity and total price
    const unitPrice = parseFloat(item.unitPrice);
    const totalPrice = (unitPrice * quantity).toFixed(2);

    const [updatedItem] = await db
      .update(invoiceItems)
      .set({ 
        quantity,
        totalPrice
      })
      .where(eq(invoiceItems.id, invoiceItemId))
      .returning();

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(item.invoiceId);

    return updatedItem;
  }

  async deleteInvoiceItem(invoiceItemId: string): Promise<void> {
    // Get the invoice item
    const [item] = await db.select().from(invoiceItems).where(eq(invoiceItems.id, invoiceItemId));
    if (!item) {
      throw new Error('Invoice item not found');
    }

    // Check that the invoice is pending
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, item.invoiceId));
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== 'Pending') {
      throw new Error('Can only delete items from pending invoices');
    }

    // Delete the item
    await db.delete(invoiceItems).where(eq(invoiceItems.id, invoiceItemId));

    // Recalculate invoice totals
    await this.recalculateInvoiceTotals(item.invoiceId);
  }

  async recalculateInvoiceTotals(invoiceId: string): Promise<Invoice> {
    // Get all invoice items
    const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

    // Get current invoice to preserve discount
    const [currentInvoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
    const discountAmount = parseFloat(currentInvoice?.discountAmount || "0");

    // Calculate total (no tax)
    const total = subtotal - discountAmount;

    // Update the invoice
    const [updatedInvoice] = await db
      .update(invoices)
      .set({
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        updatedAt: new Date()
      })
      .where(eq(invoices.id, invoiceId))
      .returning();

    return updatedInvoice;
  }

  // Activity log operations
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }

  async getActivityLogs(options?: { limit?: number; offset?: number; userId?: string; module?: string; startDate?: string; endDate?: string }): Promise<{ logs: (ActivityLog & { user: User | null })[]; total: number }> {
    const { limit = 50, offset = 0, userId, module, startDate, endDate } = options || {};
    
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(activityLogs.userId, userId));
    }
    if (module) {
      conditions.push(eq(activityLogs.module, module));
    }
    if (startDate) {
      conditions.push(sql`${activityLogs.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${activityLogs.createdAt} <= ${endDate}`);
    }
    
    const whereCondition = conditions.length > 0 
      ? (conditions.length === 1 ? conditions[0] : and(...conditions))
      : undefined;
    
    const [logsResult, totalResult] = await Promise.all([
      whereCondition
        ? db.select()
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.userId, users.id))
            .where(whereCondition)
            .orderBy(desc(activityLogs.createdAt))
            .limit(limit)
            .offset(offset)
        : db.select()
            .from(activityLogs)
            .leftJoin(users, eq(activityLogs.userId, users.id))
            .orderBy(desc(activityLogs.createdAt))
            .limit(limit)
            .offset(offset),
      whereCondition
        ? db.select({ count: count() }).from(activityLogs).where(whereCondition)
        : db.select({ count: count() }).from(activityLogs)
    ]);
    
    const logs = logsResult.map(row => ({
      ...row.activity_logs,
      user: row.users
    }));
    
    return {
      logs,
      total: totalResult[0].count
    };
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    pendingInvoices: number;
    monthlyRevenue: number;
  }> {
    const [
      totalProductsResult,
      lowStockResult,
      pendingInvoicesResult,
      monthlyRevenueResult
    ] = await Promise.all([
      db.select({ count: count() }).from(products).where(eq(products.isActive, true)),
      db.select({ count: count() }).from(products).where(
        and(eq(products.isActive, true), sql`${products.quantity} <= 5`)
      ),
      db.select({ count: count() }).from(invoices).where(eq(invoices.status, 'Pending')),
      db.select({ 
        total: sql<number>`COALESCE(SUM(${invoices.total}), 0)` 
      }).from(invoices).where(
        and(
          eq(invoices.status, 'Processed'),
          sql`${invoices.createdAt} >= date_trunc('month', current_date)`
        )
      )
    ]);

    return {
      totalProducts: totalProductsResult[0].count,
      lowStockItems: lowStockResult[0].count,
      pendingInvoices: pendingInvoicesResult[0].count,
      monthlyRevenue: monthlyRevenueResult[0].total || 0
    };
  }

  async getManufacturerStats(): Promise<{
    manufacturer: string;
    totalQuantitySold: number;
    totalRevenue: number;
    productCount: number;
  }[]> {
    const stats = await db
      .select({
        manufacturer: sql<string>`COALESCE(NULLIF(${products.manufacturer}, ''), 'Unknown')`,
        totalQuantitySold: sql<number>`SUM(${invoiceItems.quantity})`,
        totalRevenue: sql<number>`SUM(${invoiceItems.totalPrice})`,
        productCount: sql<number>`COUNT(DISTINCT ${invoiceItems.productId})`,
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoices.status, 'Processed'))
      .groupBy(sql`COALESCE(NULLIF(${products.manufacturer}, ''), 'Unknown')`)
      .orderBy(sql`SUM(${invoiceItems.quantity}) DESC`);

    return stats.map(stat => ({
      manufacturer: stat.manufacturer,
      totalQuantitySold: Number(stat.totalQuantitySold),
      totalRevenue: parseFloat(String(stat.totalRevenue)),
      productCount: Number(stat.productCount),
    }));
  }
}

export const storage = new DatabaseStorage();
