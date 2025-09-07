import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center space-x-3 mb-8">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-tshirt text-primary-foreground text-xl"></i>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">FashionHub</h1>
                <p className="text-sm text-muted-foreground">Inventory System</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Welcome to FashionHub</h2>
              <p className="text-muted-foreground">
                A comprehensive fashion inventory and invoicing system with product management, 
                QR codes, role-based access, and communication integrations.
              </p>
            </div>
            
            <div className="space-y-4">
              <Button
                onClick={() => window.location.href = '/api/login'}
                className="w-full"
                data-testid="button-login"
              >
                <i className="fas fa-sign-in-alt mr-2"></i>
                Sign In to Continue
              </Button>
              
              <div className="text-xs text-muted-foreground">
                <p>• Product management with QR codes</p>
                <p>• Invoice generation and tracking</p>
                <p>• Role-based access control</p>
                <p>• Email & WhatsApp integrations</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
