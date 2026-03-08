import { ConfigGrid } from "@/components/admin/ConfigGrid";

const columns = [
  { key: "provider_id", label: "Provider", type: "text" as const },
  { key: "currency", label: "Currency", type: "text" as const },
  { key: "rail", label: "Rail", type: "text" as const },
  { key: "is_pobo", label: "Is POBO", type: "yesno" as const },
  { key: "speed_rank", label: "Speed Rank", type: "number" as const },
  { key: "holiday_calendar", label: "Holiday Calendar", type: "text" as const },
  { key: "funding_cutoff_utc", label: "Funding Cutoff UTC", type: "text" as const },
  { key: "payout_cutoff_utc", label: "Payout Cutoff UTC", type: "text" as const },
];

const Currencies = () => (
  <div>
    <h1 className="text-xl font-semibold mb-4">Currencies Matrix</h1>
    <p className="text-sm text-muted-foreground mb-6">
      Configure currency rails, POBO flags, speed rankings, and cutoff times per provider.
    </p>
    <ConfigGrid tabKey="currenciesMatrix" columns={columns} />
  </div>
);

export default Currencies;
