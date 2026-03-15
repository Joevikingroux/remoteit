interface Props {
  code: string;
}

export default function SessionCodeDisplay({ code }: Props) {
  const formatted = code.match(/.{1,2}/g)?.join(' ') || code;

  return (
    <div className="bg-gray-50 rounded-xl py-6 px-4">
      <p className="text-sm text-gray-500 mb-2 font-medium">Your Session Code</p>
      <div className="text-5xl font-mono font-bold text-blue-600 tracking-[0.3em] select-all">
        {formatted}
      </div>
    </div>
  );
}
