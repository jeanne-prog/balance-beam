import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Auth = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ArrowRightLeft className="w-6 h-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">Capi Payment Router</CardTitle>
          <CardDescription>
            Sign in with your company Google account to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" size="lg">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
