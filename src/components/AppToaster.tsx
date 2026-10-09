import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme";

/**
 * App-level toaster. Mounted once in main.tsx: it applies the persisted
 * theme on first paint and keeps toast styling in step with light/dark mode.
 */
export function AppToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" closeButton richColors />;
}
