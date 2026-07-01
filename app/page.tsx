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

