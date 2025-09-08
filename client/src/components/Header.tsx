import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export default function Header({ title, onMenuClick }: HeaderProps) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={onMenuClick}
            data-testid="button-mobile-menu"
          >
            <i className="fas fa-bars w-5 h-5"></i>
          </Button>
          <h2 className="text-lg lg:text-xl font-semibold text-foreground">{title}</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Search Bar - Hidden on mobile */}
          <div className="relative hidden md:block">
            <Input
              type="text" 
              placeholder="Search products..." 
              className="w-40 lg:w-64 pl-10"
              data-testid="input-search"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4"></i>
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" data-testid="button-notifications">
            <i className="fas fa-bell w-5 h-5"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full text-xs"></span>
          </Button>

          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            data-testid="button-theme-toggle"
          >
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} w-5 h-5`}></i>
          </Button>
        </div>
      </div>
    </header>
  );
}
