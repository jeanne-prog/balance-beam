import { ConfigGrid } from "@/components/admin/ConfigGrid";

const columns = [
  { key: "country_code", label: "Country Code", type: "readonly" as const },
  { key: "EMQ", label: "EMQ", type: "yesno" as const },
  { key: "GIB", label: "GIB", type: "yesno" as const },
  { key: "CORPAY", label: "CORPAY", type: "yesno" as const },
  { key: "NEO", label: "NEO", type: "yesno" as const },
  { key: "TAZAPAY", label: "TAZAPAY", type: "yesno" as const },
];

const SenderMatrix = () => (
  <div>
    <h1 className="text-xl font-semibold mb-4">Sender Country Matrix</h1>
    <p className="text-sm text-muted-foreground mb-6">
      Toggle which providers can send from each country.
    </p>
    <ConfigGrid tabKey="senderCountryMatrix" columns={columns} />
  </div>
);

export default SenderMatrix;
