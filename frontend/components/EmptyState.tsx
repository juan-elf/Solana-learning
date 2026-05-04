interface Props {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="py-12 px-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4">
        {icon}
      </div>
      <p className="text-slate-200 text-sm font-medium">{title}</p>
      {description && (
        <p className="text-slate-500 text-xs mt-1.5 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
