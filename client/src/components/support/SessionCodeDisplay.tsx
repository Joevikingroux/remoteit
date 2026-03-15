interface Props {
  code: string;
}

export default function SessionCodeDisplay({ code }: Props) {
  const formatted = code.match(/.{1,2}/g)?.join(' ') || code;

  return (
    <div className="bg-n10-surface rounded-xl py-6 px-4 border border-n10-border">
      <p className="text-sm text-n10-text-dim mb-2 font-medium">Your Session Code</p>
      <div className="text-5xl font-mono font-bold text-n10-primary tracking-[0.3em] select-all">
        {formatted}
      </div>
    </div>
  );
}
