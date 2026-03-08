import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lovable } from "@/integrations/lovable/index";
import { useAuthContext } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { useState } from "react";

const Auth = () => {
  const { user, loading } = useAuthContext();
  const [signingIn, setSigningIn] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (error) {
      console.error("Sign-in error:", error);
      setSigningIn(false);
    }
  };

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
          <Button className="w-full" size="lg" onClick={handleGoogleSignIn} disabled={signingIn}>
            {signingIn ? "Signing in…" : "Sign in with Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
