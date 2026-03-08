import { ConfigGrid } from "@/components/admin/ConfigGrid";

const columns = [
  { key: "source_country_code", label: "Source Country", type: "text" as const },
  { key: "amount_usd_min", label: "Amount USD Min", type: "number" as const },
  { key: "amount_usd_max", label: "Amount USD Max", type: "number" as const },
  { key: "payout_days", label: "Payout Days", type: "number" as const },
];

const Rules = () => (
  <div>
    <h1 className="text-xl font-semibold mb-4">Routing Rules</h1>
    <p className="text-sm text-muted-foreground mb-6">
      Edit routing rules: source country, amount bands, and days after collection.
    </p>
    <ConfigGrid tabKey="routingRules" columns={columns} />
  </div>
);

export default Rules;
