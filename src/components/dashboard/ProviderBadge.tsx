import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
  CORPAY: "bg-[hsl(var(--provider-1)/0.15)] text-[hsl(var(--provider-1))] border-[hsl(var(--provider-1)/0.3)]",
  EMQ: "bg-[hsl(var(--provider-2)/0.15)] text-[hsl(var(--provider-2))] border-[hsl(var(--provider-2)/0.3)]",
  GIB: "bg-[hsl(var(--provider-3)/0.15)] text-[hsl(var(--provider-3))] border-[hsl(var(--provider-3)/0.3)]",
  NEO: "bg-[hsl(var(--provider-4)/0.15)] text-[hsl(var(--provider-4))] border-[hsl(var(--provider-4)/0.3)]",
  TAZAPAY: "bg-[hsl(var(--provider-5)/0.15)] text-[hsl(var(--provider-5))] border-[hsl(var(--provider-5)/0.3)]",
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
