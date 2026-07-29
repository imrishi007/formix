import { HomeNav } from "@/components/home/nav";
import { Hero } from "@/components/home/hero";
import { Pipeline } from "@/components/home/pipeline";
import { LiveDemo } from "@/components/home/live-demo";
import { Features } from "@/components/home/features";
import { FinalCta } from "@/components/home/final-cta";
import { HomeFooter } from "@/components/home/footer";

export default function Home() {
  return (
    <main className="noise-overlay relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <HomeNav />
      <Hero />
      <Pipeline />
      <LiveDemo />
      <Features />
      <FinalCta />
      <HomeFooter />
    </main>
  );
}
