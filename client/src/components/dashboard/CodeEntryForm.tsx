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
    <div className="flex items-center gap-4">
      <div className="flex gap-2" onPaste={handlePaste}>
        {chars.map((char, i) => (
          <span key={i} className="flex items-center">
            <input
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              value={char}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-mono font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none uppercase"
              maxLength={1}
            />
            {i === 2 && <span className="mx-1 text-gray-300 text-2xl font-light">-</span>}
          </span>
        ))}
      </div>
      <button
        onClick={() => { if (code.length === 6) onSubmit(code); }}
        disabled={code.length !== 6}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 px-8 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Connect
      </button>
    </div>
  );
}
