import { Suspense } from "react";
import { AuthForm } from "../_components/auth-form";

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthForm mode="sign-up" />
    </Suspense>
  );
}
