import {
  users,
  products,
  invoices,
  invoiceItems,
  activityLogs,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ilike, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserRole(id: string, role: string): Promise<User>;
  updateUserStatus(id: string, isActive: boolean): Promise<User>;
  updateUserLastLogin(id: string): Promise<void>;

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
  getAllInvoices(options?: { limit?: number; offset?: number; status?: string; startDate?: string; endDate?: string }): Promise<{ invoices: Invoice[]; total: number }>;
  updateInvoiceStatus(id: string, status: string, processedBy?: string): Promise<Invoice>;
  updateInvoicePdfPath(id: string, pdfPath: string): Promise<Invoice>;
  getInvoiceItems(invoiceId: string): Promise<(InvoiceItem & { product: Product })[]>;
  getInvoiceWithItems(id: string): Promise<(Invoice & { items: (InvoiceItem & { product: Product })[] }) | undefined>;

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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
    
    let query = db.select().from(products);
    let countQuery = db.select({ count: count() }).from(products);
    
    const conditions = [eq(products.isActive, true)];
    
    if (search) {
      conditions.push(ilike(products.productName, `%${search}%`));
    }
    if (category) {
      conditions.push(eq(products.category, category));
    }
    if (size) {
      conditions.push(eq(products.size, size));
    }
    if (stockLevel === 'low') {
      conditions.push(sql`${products.quantity} <= 5`);
    } else if (stockLevel === 'out') {
      conditions.push(eq(products.quantity, 0));
    } else if (stockLevel === 'in') {
      conditions.push(sql`${products.quantity} > 5`);
    }
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }
    
    const [productsResult, totalResult] = await Promise.all([
      query.orderBy(desc(products.createdAt)).limit(limit).offset(offset),
      countQuery
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

  async getAllInvoices(options?: { limit?: number; offset?: number; status?: string; startDate?: string; endDate?: string }): Promise<{ invoices: Invoice[]; total: number }> {
    const { limit = 50, offset = 0, status, startDate, endDate } = options || {};
    
    let query = db.select().from(invoices);
    let countQuery = db.select({ count: count() }).from(invoices);
    
    const conditions = [];
    
    if (status) {
      conditions.push(eq(invoices.status, status as any));
    }
    if (startDate) {
      conditions.push(sql`${invoices.createdAt} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${invoices.createdAt} <= ${endDate}`);
    }
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }
    
    const [invoicesResult, totalResult] = await Promise.all([
      query.orderBy(desc(invoices.createdAt)).limit(limit).offset(offset),
      countQuery
    ]);
    
    return {
      invoices: invoicesResult,
      total: totalResult[0].count
    };
  }

  async updateInvoiceStatus(id: string, status: string, processedBy?: string): Promise<Invoice> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === 'Processed' && processedBy) {
      updateData.processedBy = processedBy;
      updateData.processedAt = new Date();
    }
    
    const [invoice] = await db
      .update(invoices)
      .set(updateData)
      .where(eq(invoices.id, id))
      .returning();
    return invoice;
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

  // Activity log operations
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [newLog] = await db.insert(activityLogs).values(log).returning();
    return newLog;
  }

  async getActivityLogs(options?: { limit?: number; offset?: number; userId?: string; module?: string; startDate?: string; endDate?: string }): Promise<{ logs: (ActivityLog & { user: User | null })[]; total: number }> {
    const { limit = 50, offset = 0, userId, module, startDate, endDate } = options || {};
    
    let query = db
      .select()
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id));
    
    let countQuery = db.select({ count: count() }).from(activityLogs);
    
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
    
    if (conditions.length > 0) {
      const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
      query = query.where(whereCondition);
      countQuery = countQuery.where(whereCondition);
    }
    
    const [logsResult, totalResult] = await Promise.all([
      query.orderBy(desc(activityLogs.createdAt)).limit(limit).offset(offset),
      countQuery
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
}

export const storage = new DatabaseStorage();
