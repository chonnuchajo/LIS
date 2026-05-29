import { FlaskConical } from "lucide-react";
import AppLayout from "@/components/lis/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SubstancesTab from "./standardConfig/SubstancesTab";
import OverridesTab from "./standardConfig/OverridesTab";

export default function StandardConfig() {
  return (
    <AppLayout title="Standard Config">
      <div className="space-y-4">
        <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
          <FlaskConical className="w-6 h-6" />
          Standard Config
        </h1>
        <p className="text-sm text-muted-foreground">
          ตั้งค่า standard ต่อสาร + override rules (ใช้สำหรับลบสต็อกในอนาคต)
        </p>
        <Tabs defaultValue="substances" className="w-full">
          <TabsList>
            <TabsTrigger value="substances">Substances</TabsTrigger>
            <TabsTrigger value="overrides">Overrides</TabsTrigger>
          </TabsList>
          <TabsContent value="substances">
            <SubstancesTab />
          </TabsContent>
          <TabsContent value="overrides">
            <OverridesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
