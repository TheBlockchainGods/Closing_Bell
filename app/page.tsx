import { Atmosphere } from "@/components/atmosphere/Atmosphere";
import { LaunchBar } from "@/components/LaunchBar";
import { MotionRoot } from "@/components/MotionRoot";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TrustStrip } from "@/components/TrustStrip";
import { AfterHours } from "@/components/sections/AfterHours";
import { BellPot } from "@/components/sections/BellPot";
import { Countdown } from "@/components/sections/Countdown";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { HowTheBellWorksStrip } from "@/components/sections/HowTheBellWorksStrip";
import { RecentWinners } from "@/components/sections/RecentWinners";
import { Roadmap } from "@/components/sections/Roadmap";
import { YourOdds } from "@/components/sections/YourOdds";
import { BellProvider } from "@/lib/bell-store";

export default function Page() {
  return (
    <MotionRoot>
      <BellProvider>
        <Atmosphere />
        <a
          href="#bell-pot"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:border focus:border-brass-400 focus:bg-floor-900 focus:px-4 focus:py-2 focus:font-mono focus:text-[0.7rem] focus:uppercase focus:tracking-[0.16em] focus:text-brass-100"
        >
          Skip to the Bell Pot
        </a>
        <SiteHeader />
        <TrustStrip />
        <LaunchBar />
        <main className="relative z-10">
          <Hero />
          <HowTheBellWorksStrip />
          <BellPot />
          <Countdown />
          <YourOdds />
          <HowItWorks />
          <Roadmap />
          <AfterHours />
          <RecentWinners />
        </main>
        <SiteFooter />
      </BellProvider>
    </MotionRoot>
  );
}
