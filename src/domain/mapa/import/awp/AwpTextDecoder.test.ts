import { describe, expect, it } from "vitest";
import { decodeAwpText, detectTextEncoding } from "@/domain/mapa/import/awp/AwpTextDecoder";

describe("detecção de codificação", () => {
  it("reconhece BOM UTF-8", () => {
    const buffer = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("Campo=Valor", "utf8"),
    ]);
    const detection = detectTextEncoding(buffer);
    expect(detection.encoding).toBe("utf-8");
    expect(detection.hasBom).toBe(true);
    expect(decodeAwpText(buffer, detection)).toBe("Campo=Valor");
  });

  it("reconhece UTF-16 LE sem BOM pelos bytes nulos", () => {
    const buffer = Buffer.from("FileVersion_Main=1\r\nFileVersion_Sub=0", "utf16le");
    const detection = detectTextEncoding(buffer);
    expect(detection.encoding).toBe("utf-16le");
    expect(decodeAwpText(buffer, detection)).toContain("FileVersion_Main=1");
  });

  it("reconhece UTF-16 BE pelo BOM e decodifica trocando os bytes", () => {
    const little = Buffer.from("Paciente=A", "utf16le");
    const big = Buffer.from(little);
    big.swap16();
    const buffer = Buffer.concat([Buffer.from([0xfe, 0xff]), big]);
    const detection = detectTextEncoding(buffer);
    expect(detection.encoding).toBe("utf-16be");
    expect(decodeAwpText(buffer, detection)).toBe("Paciente=A");
  });

  it("não assume UTF-8 quando os bytes altos não formam sequência válida", () => {
    const buffer = Buffer.from([0x4e, 0x6f, 0x6d, 0x65, 0x3d, 0xc9, 0x0d, 0x0a]);
    const detection = detectTextEncoding(buffer);
    expect(detection.encoding).toBe("windows-1252");
    expect(decodeAwpText(buffer, detection)).toContain("Nome=É");
  });

  it("classifica ASCII puro sem inventar codificação", () => {
    const detection = detectTextEncoding(Buffer.from("1=127,70\r\n", "ascii"));
    expect(detection.encoding).toBe("ascii");
    expect(detection.textual).toBe(true);
  });

  it("marca conteúdo binário como não textual", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x00, 0x05, 0x06, 0x07, 0x08, 0x09]);
    const detection = detectTextEncoding(buffer);
    expect(detection.textual).toBe(false);
    expect(detection.encoding).toBe("binary");
  });
});
