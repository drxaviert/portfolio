import { HorizonBackground } from "@/components/horizon/horizon-background";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function Home() {
  return (
    <main className="relative min-h-dvh bg-surface text-on-surface">
      <HorizonBackground position="fixed" />

      <div className="relative px-6 py-10">
        <h1 className="text-2xl font-medium">Portfolio</h1>
        <div className="mt-6">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
