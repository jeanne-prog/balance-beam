import { ConfigGrid } from "@/components/admin/ConfigGrid";

const columns = [
  { key: "Provider", label: "Provider", type: "text" as const },
  { key: "Currency", label: "Currency", type: "text" as const },
  { key: "Target", label: "Target", type: "number" as const },
];

const Targets = () => (
  <div>
    <h1 className="text-xl font-semibold mb-4">Flow Targets</h1>
    <p className="text-sm text-muted-foreground mb-6">
      Set target volume percentages per provider.
    </p>
    <ConfigGrid tabKey="flowTargets" columns={columns} />
  </div>
);

export default Targets;
