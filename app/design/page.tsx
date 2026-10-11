"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { isClientDemoMode } from "@/lib/demo";
import { Button, IconButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Slider } from "@/components/ui/Slider";
import { Progress } from "@/components/ui/Progress";
import { Ring } from "@/components/ui/Ring";
import { Stepper } from "@/components/ui/Stepper";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tooltip } from "@/components/ui/Tooltip";
import { Switch } from "@/components/ui/Switch";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { OtpInput } from "@/components/ui/OtpInput";
import { Chip } from "@/components/ui/Chip";
import { Banner } from "@/components/ui/Banner";
import {
  Plane,
  Shield,
  Moon,
  Sun,
  Smartphone,
  Sparkles,
} from "lucide-react";

export default function DesignGalleryPage() {
  const isDemo = isClientDemoMode();
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = React.useState<"en" | "hi" | "mr">("en");
  const [switchChecked, setSwitchChecked] = React.useState(false);
  const [sliderVal, setSliderVal] = React.useState(50);
  const [otpVal, setOtpVal] = React.useState("123456");
  const [inputVal, setInputVal] = React.useState("");

  if (!isDemo && process.env.NODE_ENV !== "development") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <EmptyState
          title="Design Gallery Unavailable"
          description="The component design system gallery is accessible only in development or demo mode."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 md:p-12 space-y-12 max-w-6xl mx-auto">
      {/* Header & Theme Controls */}
      <header className="border-b border-[var(--surface-border)] pb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold tracking-widest uppercase text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-1 rounded-full">
              FlightPool Design System
            </span>
            <Badge variant="glow">v2.0 Night Runway</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display">
            Component Gallery & Living Spec
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Standardized UI primitives adhering strictly to WCAG AA contrast and theme tokens.
          </p>
        </div>

        {/* Theme and Language Switchers */}
        <div className="flex flex-wrap items-center gap-2">
          <IconButton
            aria-label="Night Runway Dark Theme"
            variant={theme === "dark" ? "primary" : "secondary"}
            onClick={() => setTheme("dark")}
          >
            <Moon className="w-4 h-4" />
          </IconButton>
          <IconButton
            aria-label="Daylight Terminal Light Theme"
            variant={theme === "light" ? "primary" : "secondary"}
            onClick={() => setTheme("light")}
          >
            <Sun className="w-4 h-4" />
          </IconButton>
          <IconButton
            aria-label="AMOLED Pure Black Theme"
            variant={theme === "amoled" ? "primary" : "secondary"}
            onClick={() => setTheme("amoled")}
          >
            <Smartphone className="w-4 h-4" />
          </IconButton>
          <div className="h-6 w-px bg-[var(--surface-border)] mx-1" />
          <Chip selected={lang === "en"} onClick={() => setLang("en")}>
            EN
          </Chip>
          <Chip selected={lang === "hi"} onClick={() => setLang("hi")}>
            HI
          </Chip>
          <Chip selected={lang === "mr"} onClick={() => setLang("mr")}>
            MR
          </Chip>
        </div>
      </header>

      {/* Buttons & IconButtons */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--primary)] pl-3">
          1. Buttons & Actions
        </h2>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary Runway</Button>
          <Button variant="secondary">Secondary Surface</Button>
          <Button variant="accent">Accent Beacon</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger SOS</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <IconButton aria-label="Shield Action" variant="primary">
            <Shield className="w-4 h-4" />
          </IconButton>
        </div>
      </section>

      {/* Badges & Chips */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--accent)] pl-3">
          2. Badges & Chips
        </h2>
        <div className="flex flex-wrap gap-2.5 items-center">
          <Badge variant="default">Default</Badge>
          <Badge variant="primary">Runway Amber</Badge>
          <Badge variant="accent">Beacon Teal</Badge>
          <Badge variant="rewards">Rewards Violet</Badge>
          <Badge variant="success">Verified Passenger</Badge>
          <Badge variant="solo">Solo Fallback</Badge>
          <Badge variant="glow">Live Dynamic</Badge>
          <Chip selected={false}>Unselected Chip</Chip>
          <Chip selected={true}>Selected Chip</Chip>
          <Chip selected={true} variant="primary">
            Amber Chip
          </Chip>
          <Chip selected={true} variant="accent">
            Teal Chip
          </Chip>
        </div>
      </section>

      {/* Form Controls */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--rewards)] pl-3">
          3. Inputs & Form Controls
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input
            id="demo-input"
            label="Flight Number"
            placeholder="e.g. 6E-204"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            leftIcon={<Plane className="w-4 h-4" />}
          />
          <Select
            id="demo-select"
            label="Destination Corridor"
            options={[
              { value: "thane", label: "Thane (via Eastern Express)" },
              { value: "powai", label: "Powai (via JVLR)" },
              { value: "bandra", label: "Bandra (via Western Express)" },
            ]}
          />
          <div className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              6-Box OTP Verification
            </span>
            <OtpInput value={otpVal} onChange={setOtpVal} />
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--surface-border)]">
          <Switch
            id="demo-switch"
            checked={switchChecked}
            onCheckedChange={setSwitchChecked}
            aria-label="Women-Only Pooling Option"
          />
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Women-Only Pooling</div>
            <div className="text-xs text-[var(--text-muted)]">
              Match strictly with verified female co-passengers.
            </div>
          </div>
        </div>
      </section>

      {/* Sliders, Progress & Rings */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--primary)] pl-3">
          4. Gauges, Sliders & Rings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <Card className="p-5 space-y-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[var(--text-muted)]">Wait vs Save Ratio</span>
              <span className="text-[var(--primary)] font-mono">{sliderVal}%</span>
            </div>
            <Slider
              value={[sliderVal]}
              onValueChange={([v]) => setSliderVal(v)}
              min={0}
              max={100}
              step={1}
            />
            <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
              <span>Leave sooner</span>
              <span>Save more</span>
            </div>
          </Card>

          <Card className="p-5 space-y-3">
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              Pool Formation Progress
            </div>
            <Progress value={66} />
            <div className="text-xs text-[var(--text-muted)]">2 of 3 seats filled</div>
          </Card>

          <Card className="p-5 flex items-center justify-center gap-6">
            <Ring value={75} size={90} strokeWidth={8} color="var(--primary)">
              <div className="text-center font-mono">
                <span className="text-lg font-black text-[var(--text)]">48%</span>
                <span className="block text-[9px] text-[var(--text-muted)] uppercase">Saved</span>
              </div>
            </Ring>
            <div className="text-xs space-y-1">
              <div className="font-bold text-[var(--text)]">Guaranteed Minimum</div>
              <div className="text-[var(--text-muted)]">₹360 locked fare</div>
            </div>
          </Card>
        </div>
      </section>

      {/* Steppers & Flight Path */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--accent)] pl-3">
          5. Journey Stepper & Path
        </h2>
        <Card className="p-6">
          <Stepper
            steps={[
              { id: "profile", label: "Profile" },
              { id: "flight", label: "Flight" },
              { id: "boarding", label: "Boarding" },
              { id: "corridor", label: "Corridor" },
              { id: "pool", label: "Cab Pool" },
            ]}
            currentStep={3}
          />
        </Card>
      </section>

      {/* Banners & Alerts */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--info)] pl-3">
          6. Banners & Notifications
        </h2>
        <div className="space-y-3">
          <Banner variant="info" title="Terminal 2 Live Flight Wave">
            32 riders landed from Delhi and Bengaluru currently pooling to Thane and Powai.
          </Banner>
          <Banner variant="success" title="3.9 kg CO2 Saved">
            Your shared ride reduced carbon emission compared to individual solo airport cabs.
          </Banner>
          <Banner variant="warning" title="15-Minute Wait Cap Reached">
            Keep waiting for a third co-rider or transition immediately to guaranteed solo taxi.
          </Banner>
          <Banner variant="danger" title="Safety SOS Protocol Active">
            Emergency coordinates broadcast to Airport Marshal station and Mumbai Police.
          </Banner>
        </div>
      </section>

      {/* States & Skeletons */}
      <section className="space-y-6">
        <h2 className="text-lg font-bold text-[var(--text)] border-l-4 border-[var(--danger)] pl-3">
          7. States, Skeletons & Tooltips
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ErrorState
            title="Database Sync Delay"
            message="Unable to fetch live bay allocations. Click below to refresh."
            onRetry={() => {}}
          />
          <EmptyState
            title="No Outbound Rides Found"
            description="All landing waves for Terminal 1 have cleared for the night."
          />
        </div>
        <div className="flex items-center gap-4">
          <Avatar name="Aarav Sharma" size="lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Tooltip content="Verified airline boarding pass passenger">
            <Badge variant="success">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Hover for Tooltip
            </Badge>
          </Tooltip>
        </div>
      </section>
    </div>
  );
}
