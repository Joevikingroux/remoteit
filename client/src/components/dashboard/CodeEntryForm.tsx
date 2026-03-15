import { useState, useRef, KeyboardEvent } from 'react';

interface Props {
  onSubmit: (code: string) => void;
}

const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export default function CodeEntryForm({ onSubmit }: Props) {
  const [chars, setChars] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
    const char = value.toUpperCase().slice(-1);
    if (char && !SAFE_CHARS.includes(char)) return;

    const newChars = [...chars];
    newChars[index] = char;
    setChars(newChars);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !chars[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      const code = chars.join('');
      if (code.length === 6) onSubmit(code);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
    const newChars = [...chars];
    for (let i = 0; i < pasted.length; i++) {
      newChars[i] = pasted[i];
    }
    setChars(newChars);
    const focusIndex = Math.min(pasted.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const code = chars.join('');

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5 min-w-0" onPaste={handlePaste}>
        {chars.map((char, i) => (
          <span key={i} className="flex items-center">
            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              value={char}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-13 text-center text-xl font-mono font-bold bg-n10-surface border-2 border-n10-border rounded-lg text-n10-text focus:border-n10-primary focus:ring-2 focus:ring-n10-primary/30 outline-none uppercase transition-colors"
              maxLength={1}
            />
            {i === 2 && <span className="mx-1 text-n10-text-dim text-xl font-light">-</span>}
          </span>
        ))}
      </div>
      <button
        onClick={() => { if (code.length === 6) onSubmit(code); }}
        disabled={code.length !== 6}
        className="btn-gradient text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
      >
        Connect
      </button>
    </div>
  );
}
