interface NumberPadProps {
  onDigit: (d: number) => void;
  onErase: () => void;
  pencilMode: boolean;
  onTogglePencil: () => void;
  digitCounts: number[]; // length 10, index 1..9 holds count of digit on board
}

export function NumberPad({
  onDigit,
  onErase,
  pencilMode,
  onTogglePencil,
  digitCounts,
}: NumberPadProps) {
  return (
    <div className="pad">
      <div className="pad-row">
        {Array.from({ length: 9 }, (_, k) => {
          const d = k + 1;
          const done = digitCounts[d] >= 9;
          return (
            <button
              key={d}
              type="button"
              className={`pad-digit ${done ? 'done' : ''}`}
              onClick={() => onDigit(d)}
              disabled={done && !pencilMode}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="pad-row pad-actions">
        <button
          type="button"
          className={`pad-toggle ${pencilMode ? 'active' : ''}`}
          onClick={onTogglePencil}
          title="Toggle pencil mode (P)"
        >
          {pencilMode ? 'Pencil: on' : 'Pencil: off'}
        </button>
        <button type="button" className="pad-erase" onClick={onErase} title="Erase (Backspace)">
          Erase
        </button>
      </div>
    </div>
  );
}
