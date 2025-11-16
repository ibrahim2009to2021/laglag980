import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/Untitled design (4)_1763333434641.png";

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
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      <div className="w-full max-w-md">
        <Card className="bg-white border-gray-200 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-32 h-32 flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="Volume Fashion Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">Volume Fashion Collection</CardTitle>
            <p className="text-gray-600">Fashion Inventory & Invoicing System</p>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your username"
                          disabled={isLoading}
                          data-testid="input-username"
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-700">Password</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          placeholder="Enter your password"
                          disabled={isLoading}
                          data-testid="input-password"
                          className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
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
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    data-testid="link-forgot-password"
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>
            </Form>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <i className="fas fa-info-circle text-blue-600 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-2">Default Admin Credentials</p>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><span className="text-gray-600">Username:</span> <span className="font-mono text-blue-700">abd.rabo.940@gmail.com</span></p>
                    <p><span className="text-gray-600">Password:</span> <span className="font-mono text-blue-700">New@2025</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg text-left">
              <p className="text-sm font-medium text-gray-900 mb-2">Volume Fashion Collection</p>
              <div className="text-xs text-gray-600 space-y-1">
                <p>Address: 4006-4008Room, 5Floor,changjiang Internation Garment Building ,No.931,Renmingbei Road , Yuexiu District,Guangzhou.China</p>
                <p>Phone: <a href="tel:+8613288689165" className="text-blue-400 hover:text-blue-300">+86 132 8868 9165</a></p>
                <p>
                  WhatsApp:
                  <a 
                    href="https://wa.link/mb5xbk" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 ml-1"
                  >
                    +962796100166
                  </a>
                  . 
                  <a 
                    href="https://wa.link/g3bblj" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300"
                  >
                    +8613660002778
                  </a>
                </p>
                <p>
                  <a 
                    href="https://instagram.com/volume_fashion1" 
                    target="_blank" 
                    style={{textDecoration: 'none', color: 'inherit'}}
                    className="inline-flex items-center"
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