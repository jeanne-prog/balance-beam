import { ConfigGrid } from "@/components/admin/ConfigGrid";

const beneColumns = [
  { key: "Provider", label: "Provider", type: "text" as const },
  { key: "Bene name", label: "Bene Name", type: "text" as const },
];

const swiftColumns = [
  { key: "Provider", label: "Provider", type: "text" as const },
  { key: "Code", label: "Code", type: "text" as const },
];

const senderColumns = [
  { key: "Provider", label: "Provider", type: "text" as const },
  { key: "Sender", label: "Sender", type: "text" as const },
];

const Beneficiaries = () => (
  <div className="space-y-10">
    <div>
      <h1 className="text-xl font-semibold mb-4">Banned Beneficiaries</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manage banned beneficiaries, SWIFT codes, and senders per provider.
      </p>
      <ConfigGrid tabKey="benesBanned" columns={beneColumns} title="Banned Beneficiaries" />
    </div>

    <ConfigGrid tabKey="swiftCodesBanned" columns={swiftColumns} title="Banned SWIFT Codes" />

    <ConfigGrid tabKey="sendersBanned" columns={senderColumns} title="Banned Senders" />
  </div>
);

export default Beneficiaries;
