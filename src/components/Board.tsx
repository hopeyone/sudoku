import { memo } from 'react';
import { N, SIZE, bitFor, boxOf, colOf, rowOf } from '../sudoku/grid';

interface BoardProps {
  given: number[];
  entries: number[];
  pencil: number[];
  selected: number;
  solved: boolean;
  onSelect: (i: number) => void;
}

interface CellProps {
  i: number;
  given: number;
  entry: number;
  pencilMask: number;
  selected: boolean;
  inUnit: boolean;
  sameDigit: boolean;
  onSelect: (i: number) => void;
}

function Cell({
  i,
  given,
  entry,
  pencilMask,
  selected,
  inUnit,
  sameDigit,
  onSelect,
}: CellProps) {
  const value = given || entry;
  const classes = ['cell'];
  if (given) classes.push('given');
  if (selected) classes.push('selected');
  else if (sameDigit) classes.push('same-digit');
  else if (inUnit) classes.push('peer');
  if (rowOf(i) % 3 === 0) classes.push('border-top');
  if (colOf(i) % 3 === 0) classes.push('border-left');
  if (rowOf(i) === N - 1) classes.push('border-bottom');
  if (colOf(i) === N - 1) classes.push('border-right');

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={() => onSelect(i)}
      tabIndex={-1}
      data-cell={i}
      data-given={given ? '1' : '0'}
    >
      {value !== 0 ? (
        <span className="value">{value}</span>
      ) : pencilMask !== 0 ? (
        <span className="pencil">
          {Array.from({ length: 9 }, (_, k) => (
            <span key={k} className="pmark">
              {pencilMask & bitFor(k + 1) ? k + 1 : ''}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
}

const MemoCell = memo(Cell);

export function Board({ given, entries, pencil, selected, solved, onSelect }: BoardProps) {
  const sR = rowOf(selected);
  const sC = colOf(selected);
  const sB = boxOf(selected);
  const selectedValue = given[selected] || entries[selected] || 0;

  return (
    <div className={`board ${solved ? 'solved' : ''}`}>
      {Array.from({ length: SIZE }, (_, i) => {
        const v = given[i] || entries[i];
        return (
          <MemoCell
            key={i}
            i={i}
            given={given[i]}
            entry={entries[i]}
            pencilMask={pencil[i]}
            selected={i === selected}
            inUnit={rowOf(i) === sR || colOf(i) === sC || boxOf(i) === sB}
            sameDigit={selectedValue !== 0 && v === selectedValue}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
