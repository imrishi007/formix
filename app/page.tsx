<<<<<<< HEAD
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { DemoSection } from "@/components/landing/demo-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden noise-overlay bg-background text-foreground">
      <Navigation />
      <HeroSection />
      <HowItWorksSection />
      <DemoSection />
      <MetricsSection />
      <CtaSection />
      <FooterSection />
    </main>
  );
}

=======
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
>>>>>>> f6620dd (Complete Formix updates)
