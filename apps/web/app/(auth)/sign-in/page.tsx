import { Suspense } from "react";
import { AuthForm } from "../_components/auth-form";

export default function SignInPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-in" />
    </Suspense>
  );
}
