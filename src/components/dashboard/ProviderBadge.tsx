import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const PROVIDER_COLORS: Record<string, string> = {
  CORPAY: "bg-[hsl(var(--provider-1)/0.15)] text-[hsl(var(--provider-1))] border-[hsl(var(--provider-1)/0.3)]",
  EMQ: "bg-[hsl(var(--provider-2)/0.15)] text-[hsl(var(--provider-2))] border-[hsl(var(--provider-2)/0.3)]",
  GIB: "bg-[hsl(var(--provider-3)/0.15)] text-[hsl(var(--provider-3))] border-[hsl(var(--provider-3)/0.3)]",
  NEO: "bg-[hsl(var(--provider-4)/0.15)] text-[hsl(var(--provider-4))] border-[hsl(var(--provider-4)/0.3)]",
  TAZAPAY: "bg-[hsl(var(--provider-5)/0.15)] text-[hsl(var(--provider-5))] border-[hsl(var(--provider-5)/0.3)]",
};

export const PROVIDER_TRIGGER_COLORS: Record<string, string> = {
  CORPAY: "border-[hsl(var(--provider-1)/0.4)] bg-[hsl(var(--provider-1)/0.06)]",
  EMQ: "border-[hsl(var(--provider-2)/0.4)] bg-[hsl(var(--provider-2)/0.06)]",
  GIB: "border-[hsl(var(--provider-3)/0.4)] bg-[hsl(var(--provider-3)/0.06)]",
  NEO: "border-[hsl(var(--provider-4)/0.4)] bg-[hsl(var(--provider-4)/0.06)]",
  TAZAPAY: "border-[hsl(var(--provider-5)/0.4)] bg-[hsl(var(--provider-5)/0.06)]",
};

interface Props {
  provider: string;
  className?: string;
}

export function ProviderBadge({ provider, className }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium font-mono-numbers border",
        PROVIDER_COLORS[provider] ?? "",
        className
      )}
    >
      {provider}
    </Badge>
  );
}
