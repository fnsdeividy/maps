const BYTES_PER_ROW = 8;

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

function toAscii(byte: number): string {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : ".";
}

/**
 * Visualiza um registro byte a byte. A coluna "Campo identificado" só é
 * preenchida quando existe um layout confirmado: sem evidência, o campo fica
 * explicitamente como não identificado.
 */
export function HexViewer({
  bytes,
  identifiedFields,
}: {
  bytes: number[];
  identifiedFields?: Record<number, string>;
}) {
  const rows: number[][] = [];
  for (let offset = 0; offset < bytes.length; offset += BYTES_PER_ROW) {
    rows.push(bytes.slice(offset, offset + BYTES_PER_ROW));
  }

  return (
    <table className="w-full font-mono text-xs">
      <thead className="text-left text-slate-500">
        <tr>
          <th className="py-1 pr-3">Offset</th>
          <th className="py-1 pr-3">Hex</th>
          <th className="py-1 pr-3">Decimal</th>
          <th className="py-1 pr-3">ASCII</th>
          <th className="py-1">Campo identificado</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => {
          const baseOffset = rowIndex * BYTES_PER_ROW;
          const labels = row
            .map((_, position) => identifiedFields?.[baseOffset + position])
            .filter(Boolean);
          return (
            <tr className="border-t border-slate-100" key={baseOffset}>
              <td className="py-1 pr-3 text-slate-500">
                {baseOffset.toString(16).padStart(4, "0").toUpperCase()}
              </td>
              <td className="py-1 pr-3">{row.map(toHex).join(" ")}</td>
              <td className="py-1 pr-3 text-slate-600">{row.join(" ")}</td>
              <td className="py-1 pr-3 text-slate-600">{row.map(toAscii).join("")}</td>
              <td className="py-1 text-slate-500">
                {labels.length > 0 ? labels.join(", ") : "não identificado"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
