import { Shield, Zap, Route } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800/60">
      {/* Animated atmospheric orbs — drift slowly behind content */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-cyan-500/10 blur-3xl animate-aqueduct-drift" />
        <div
          className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-blue-500/10 blur-3xl animate-aqueduct-drift"
          style={{ animationDelay: "4s" }}
        />
        {/* Faint grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.06)_1px,_transparent_0)] bg-[size:24px_24px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="bg-gradient-to-br from-white via-cyan-50 to-cyan-300 bg-clip-text text-transparent">
            Aqueduct
          </span>
        </h1>
        <p className="mt-3 text-slate-400 text-base sm:text-lg max-w-xl leading-relaxed">
          Stream SOL into long positions, one signal at a time. Non-custodial DCA vault
          with on-chain slippage and allocation caps.
        </p>

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <Pill icon={<Shield className="w-3.5 h-3.5" />} label="Non-custodial" />
          <Pill icon={<Zap className="w-3.5 h-3.5" />} label="On-chain slippage cap" />
          <Pill icon={<Route className="w-3.5 h-3.5" />} label="Jupiter v6 routing" />
        </div>
      </div>
    </section>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800/60 text-slate-300 border border-slate-700 backdrop-blur">
      <span className="text-cyan-400">{icon}</span>
      {label}
    </span>
  );
}
