import { redirect } from "next/navigation";

export default function BiometricLogsRedirect() {
  redirect("/biometrics?tab=biometric-logs");
}
