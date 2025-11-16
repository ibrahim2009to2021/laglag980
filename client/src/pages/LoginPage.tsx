import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/Untitled design (5)_1763333606386.png";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (response.ok) {
        // Successful login - reload the page to trigger auth check
        window.location.href = "/";
      } else {
        const error = await response.json();
        toast({
          title: "Login Failed",
          description: error.message || "Invalid username or password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Unable to connect to server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#1800ad' }}>
      <div className="w-full max-w-md">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-32 h-32 flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="Volume Fashion Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-white">Volume Fashion Collection</CardTitle>
            <p className="text-white/90">Fashion Inventory & Invoicing System</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your username"
                          disabled={isLoading}
                          data-testid="input-username"
                          className="bg-white/90 border-white/30 text-gray-900 placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                        />
                      </FormControl>
                      <FormMessage className="text-yellow-300" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white">Password</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          placeholder="Enter your password"
                          disabled={isLoading}
                          data-testid="input-password"
                          className="bg-white/90 border-white/30 text-gray-900 placeholder:text-gray-500 focus:border-yellow-400 focus:ring-yellow-400"
                        />
                      </FormControl>
                      <FormMessage className="text-yellow-300" />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold shadow-lg" 
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Signing In...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt mr-2"></i>
                      Sign In
                    </>
                  )}
                </Button>

                <div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => window.location.href = '/forgot-password'}
                    className="text-sm text-yellow-300 hover:text-yellow-200 transition-colors"
                    data-testid="link-forgot-password"
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg">
              <div className="flex items-start gap-3">
                <i className="fas fa-info-circle text-yellow-300 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-white mb-2">Default Admin Credentials</p>
                  <div className="text-sm text-white/90 space-y-1">
                    <p><span className="text-white/70">Username:</span> <span className="font-mono text-yellow-300">abd.rabo.940@gmail.com</span></p>
                    <p><span className="text-white/70">Password:</span> <span className="font-mono text-yellow-300">New@2025</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg text-left">
              <p className="text-sm font-medium text-white mb-2">Volume Fashion Collection</p>
              <div className="text-xs text-white/90 space-y-1">
                <p>Address: 4006-4008Room, 5Floor,changjiang Internation Garment Building ,No.931,Renmingbei Road , Yuexiu District,Guangzhou.China</p>
                <p>Phone: <a href="tel:+8613288689165" className="text-yellow-300 hover:text-yellow-200">+86 132 8868 9165</a></p>
                <p>
                  WhatsApp:
                  <a 
                    href="https://wa.link/mb5xbk" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-200 ml-1"
                  >
                    +962796100166
                  </a>
                  . 
                  <a 
                    href="https://wa.link/g3bblj" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-yellow-300 hover:text-yellow-200"
                  >
                    +8613660002778
                  </a>
                </p>
                <p>
                  <a 
                    href="https://instagram.com/volume_fashion1" 
                    target="_blank" 
                    style={{textDecoration: 'none'}}
                    className="inline-flex items-center text-white/90 hover:text-white"
                  >
                    <img 
                      src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Instagram_icon.png" 
                      alt="Instagram" 
                      width="20" 
                      height="20"
                      style={{verticalAlign: 'middle', marginRight: '5px'}}
                      className="inline-block"
                    />
                    <span>@volume_fashion1</span>
                  </a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}