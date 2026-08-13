import { Label } from "@/components/ui/label";

interface FieldRowProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function FieldRow({ label, hint, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
