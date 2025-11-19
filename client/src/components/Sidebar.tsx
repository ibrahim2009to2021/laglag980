import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import logoImage from "@assets/Untitled design (5)_1763333606386.png";
import { useState } from "react";

interface SidebarProps {
  currentPage: string;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const navigationItems = [
  { id: "dashboard", path: "/", icon: "fas fa-chart-line", label: "Dashboard", roles: ["Admin", "Manager", "Staff", "Viewer"] },
  { id: "products", path: "/products", icon: "fas fa-box", label: "Products", roles: ["Admin", "Manager", "Staff", "Viewer"] },
  { id: "add-product", path: "/add-product", icon: "fas fa-plus", label: "Add Product", roles: ["Admin", "Manager", "Staff"] },
  { id: "bulk-upload", path: "/bulk-upload", icon: "fas fa-upload", label: "Bulk Upload", roles: ["Admin", "Manager"] },
  { id: "invoices", path: "/invoices", icon: "fas fa-file-invoice", label: "Invoices", roles: ["Admin", "Manager", "Staff", "Viewer"] },
  { id: "create-invoice", path: "/create-invoice", icon: "fas fa-plus-circle", label: "Create Invoice", roles: ["Admin", "Manager", "Staff"] },
  { id: "reports", path: "/reports", icon: "fas fa-chart-bar", label: "Reports", roles: ["Admin", "Manager", "Viewer"] },
  { id: "users", path: "/users", icon: "fas fa-users", label: "User Management", roles: ["Admin"] },
  { id: "activity-logs", path: "/activity-logs", icon: "fas fa-history", label: "Activity Logs", roles: ["Admin", "Manager"] },
];

export default function Sidebar({ currentPage, onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const userInitials = user?.firstName && user?.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  const filteredNavItems = navigationItems.filter(item => 
    item.roles.includes(user?.role || 'Viewer')
  );

  return (
    <aside 
      className={cn(
        "flex flex-col h-screen border-r border-sidebar-border gradient-sidebar transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className={cn("p-6", isCollapsed && "p-4")}>
        <div className="flex items-center justify-between mb-8">
          <div className={cn("flex items-center", isCollapsed ? "justify-center w-full" : "space-x-3")}>
            {!isCollapsed && (
              <div className="w-24 h-12 flex items-center justify-center">
                <img 
                  src={logoImage} 
                  alt="Volume Fashion Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
            )}
            {isCollapsed && (
              <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">VF</span>
              </div>
            )}
          </div>
          
          {/* Desktop Collapse Button */}
          {!onClose && onToggleCollapse && (
            <button 
              onClick={onToggleCollapse}
              className="hidden lg:block text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1"
              data-testid="button-toggle-sidebar"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <i className={cn("fas", isCollapsed ? "fa-chevron-right" : "fa-chevron-left", "w-4 h-4")}></i>
            </button>
          )}
          
          {/* Mobile Close Button */}
          {onClose && (
            <button 
              onClick={onClose}
              className="lg:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors p-1"
              data-testid="button-close-sidebar"
            >
              <i className="fas fa-times w-5 h-5"></i>
            </button>
          )}
        </div>

        <nav className="space-y-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              className={cn(
                "w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isCollapsed ? "justify-center" : "space-x-3",
                currentPage === item.id 
                  ? "bg-white text-gray-900 shadow-md" 
                  : "text-sidebar-foreground/90 hover:bg-white/10 hover:text-sidebar-foreground"
              )}
              data-testid={`nav-${item.id}`}
              title={isCollapsed ? item.label : undefined}
            >
              <i className={`${item.icon} w-4 h-4`}></i>
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>
      </div>

      {/* User Profile Section */}
      <div className={cn("mt-auto p-6 border-t border-sidebar-border", isCollapsed && "p-4")}>
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
              <span className="text-sm font-semibold text-gray-900">{userInitials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email}
              </p>
              <p className="text-xs text-sidebar-foreground/70">{user?.role || 'Viewer'}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              data-testid="button-logout"
              title="Logout"
            >
              <i className="fas fa-sign-out-alt w-4 h-4"></i>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
              <span className="text-sm font-semibold text-gray-900">{userInitials}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              data-testid="button-logout"
              title="Logout"
            >
              <i className="fas fa-sign-out-alt w-4 h-4"></i>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
