import { Box, Text, useInput } from "ink";

export interface Column<T> {
  title: string;
  width: number;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onEnter?: (index: number) => void;
  onEscape?: () => void;
}

export function Table<T>({
  columns,
  rows,
  getRowKey,
  selectedIndex,
  onSelect,
  onEnter,
  onEscape,
}: TableProps<T>) {
  useInput((_input, key) => {
    if (key.upArrow && selectedIndex > 0) {
      onSelect(selectedIndex - 1);
    }
    if (key.downArrow && selectedIndex < rows.length - 1) {
      onSelect(selectedIndex + 1);
    }
    if (key.return && onEnter && rows.length > 0) {
      onEnter(selectedIndex);
    }
    if (key.escape && onEscape) {
      onEscape();
    }
  });

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {columns.map((col) => (
          <Box key={col.title} width={col.width}>
            <Text bold dimColor>
              {col.title}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {rows.map((row, i) => (
        <Box key={getRowKey(row, i)}>
          {columns.map((col) => (
            <Box key={col.title} width={col.width}>
              {i === selectedIndex ? (
                <Text inverse>{col.render(row)}</Text>
              ) : (
                <Text>{col.render(row)}</Text>
              )}
            </Box>
          ))}
        </Box>
      ))}

      {rows.length === 0 && (
        <Box>
          <Text dimColor>No items</Text>
        </Box>
      )}
    </Box>
  );
}
