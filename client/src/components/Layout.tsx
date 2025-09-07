import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import AddProduct from "@/pages/AddProduct";
import BulkUpload from "@/pages/BulkUpload";
import Invoices from "@/pages/Invoices";
import CreateInvoice from "@/pages/CreateInvoice";
import InvoiceDetail from "@/pages/InvoiceDetail";
import UserManagement from "@/pages/UserManagement";
import ActivityLogs from "@/pages/ActivityLogs";
import ProtectedRoute from "@/components/ProtectedRoute";

interface LayoutProps {
  page: string;
}

const pageComponents = {
  dashboard: Dashboard,
  products: Products,
  "product-detail": ProductDetail,
  "add-product": AddProduct,
  "bulk-upload": BulkUpload,
  invoices: Invoices,
  "invoice-detail": InvoiceDetail,
  "create-invoice": CreateInvoice,
  users: UserManagement,
  "activity-logs": ActivityLogs,
};

const pageTitles = {
  dashboard: 'Dashboard',
  products: 'Products',
  "product-detail": 'Product Details',
  "add-product": 'Add Product',
  "bulk-upload": 'Bulk Upload',
  invoices: 'Invoices',
  "invoice-detail": 'Invoice Details',
  "create-invoice": 'Create Invoice',
  users: 'User Management',
  "activity-logs": 'Activity Logs',
};

export default function Layout({ page }: LayoutProps) {
  const PageComponent = pageComponents[page as keyof typeof pageComponents] || Dashboard;
  const pageTitle = pageTitles[page as keyof typeof pageTitles] || 'Dashboard';

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex bg-background">
        <Sidebar currentPage={page} />
        <main className="flex-1 overflow-hidden">
          <Header title={pageTitle} />
          <div className="flex-1 overflow-y-auto p-6">
            <PageComponent />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
