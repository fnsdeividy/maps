import { describe, expect, it } from "vitest";
import { AwpFormatDetector } from "@/domain/mapa/import/awp/AwpFormatDetector";

const detector = new AwpFormatDetector();

function detect(content: string, fileName = "exame.awp") {
  return detector.detect({ buffer: Buffer.from(content, "latin1"), fileName });
}

describe("AwpFormatDetector", () => {
  it("identifica versão a partir de FileVersion_Main e FileVersion_Sub", () => {
    const { descriptor } = detect(
      [
        "[FileInfo]",
        "FileVersion_Main=1",
        "FileVersion_Sub=2",
        "DeviceModel=ABPM50",
        "1=SYS:127,DIA:70",
      ].join("\r\n"),
    );

    expect(descriptor.version).toBe("1.2");
    expect(descriptor.formatId).toBe("contec-abpm50-ini-v1.2");
    expect(descriptor.kind).toBe("INI_TEXT");
    expect(descriptor.recordCount).toBe(1);
  });

  it("separa metadados de registros numerados", () => {
    const { document } = detect(
      ["PatientName=X", "1=a", "2=b", "3=c"].join("\n"),
    );
    expect(document.metadata).toHaveLength(1);
    expect(document.measurementRecords.map((entry) => entry.key)).toEqual(["1", "2", "3"]);
  });

  it("nunca reporta VERIFIED sem fixture registrada", () => {
    const { descriptor } = detect(["FileVersion_Main=1", "1=SYS:120,DIA:80"].join("\n"));
    expect(descriptor.confidence).toBe("PARTIAL");
  });

  it("reporta UNKNOWN para conteúdo binário", () => {
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x00, 0x04, 0x05, 0x06, 0x07, 0x01, 0x02]);
    const { descriptor } = detector.detect({ buffer, fileName: "exame.awp" });
    expect(descriptor.kind).toBe("BINARY");
    expect(descriptor.confidence).toBe("UNKNOWN");
  });

  it("preserva comentários e linhas sem chave=valor", () => {
    const { document } = detect([";exportado", "linha solta", "1=SYS:120,DIA:80"].join("\n"));
    expect(document.comments[0].text).toBe("exportado");
    expect(document.unknownFields[0].text).toBe("linha solta");
  });

  it("registra a assinatura dos primeiros bytes", () => {
    const { descriptor } = detect("FileVersion_Main=1\n1=SYS:120,DIA:80");
    expect(descriptor.signature.startsWith("46 69 6C 65")).toBe(true);
  });
});
