import ProductionShootPlanDock from "@/components/ProductionShootPlanDock";

export default function ProductionsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <ProductionShootPlanDock />
    </>
  );
}
