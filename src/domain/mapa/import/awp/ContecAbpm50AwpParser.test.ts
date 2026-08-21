import { describe, expect, it } from "vitest";
import { ContecAbpm50AwpParser } from "@/domain/mapa/import/awp/ContecAbpm50AwpParser";
import {
  InvalidAwpFileError,
  NoMeasurementsFoundError,
} from "@/domain/mapa/import/awp/errors";
import { CONTEC_AWP_PARSER_VERSION } from "@/domain/mapa/import/awp/constants";

const parser = new ContecAbpm50AwpParser();

const LABELED_FILE = [
  "[FileInfo]",
  "FileVersion_Main=1",
  "FileVersion_Sub=0",
  "DeviceModel=ABPM50",
  "PatientName=PACIENTE TESTE",
  "SleepStart=22:45",
  "WakeTime=06:30",
  "CampoDesconhecido=42",
  ";exportado pelo software do aparelho",
  "linha sem chave",
  "[Data]",
  "1=Date:2024-09-13,Time:08:30,SYS:127,DIA:70,PR:72",
  "2=Date:2024-09-13,Time:09:00,SYS:132,DIA:75,PR:78",
  "3=Date:2024-09-14,Time:02:00,SYS:112,DIA:63,PR:60",
].join("\r\n");

function buffer(content: string) {
  return Buffer.from(content, "latin1");
}

describe("ContecAbpm50AwpParser", () => {
  it("recusa arquivo com outra extensão", () => {
    expect(parser.canParse(buffer(LABELED_FILE), "exame.txt")).toBe(false);
    expect(parser.canParse(buffer(LABELED_FILE), "exame.AWP")).toBe(true);
  });

  it("extrai medições quando o arquivo nomeia cada campo", async () => {
    const result = await parser.parse(buffer(LABELED_FILE), "exame.awp");

    expect(result.manufacturer).toBe("CONTEC");
    expect(result.deviceModel).toBe("ABPM50");
    expect(result.parserVersion).toBe(CONTEC_AWP_PARSER_VERSION);
    expect(result.detectedVersion).toBe("1.0");
    expect(result.measurements).toHaveLength(3);

    const [first] = result.measurements;
    expect(first.systolic).toBe(127);
    expect(first.diastolic).toBe(70);
    expect(first.heartRate).toBe(72);
    expect(first.valid).toBe(true);
    expect(first.measuredAt.getHours()).toBe(8);
    expect(first.measuredAt.getMinutes()).toBe(30);
  });

  it("usa a janela de sono declarada pelo arquivo", async () => {
    const result = await parser.parse(buffer(LABELED_FILE), "exame.awp");
    expect(result.sleepWindow).toEqual(
      expect.objectContaining({ start: "22:45", end: "06:30", source: "FILE" }),
    );
  });

  it("preserva comentários, linhas soltas e campos desconhecidos", async () => {
    const result = await parser.parse(buffer(LABELED_FILE), "exame.awp");
    expect(result.comments).toContain("exportado pelo software do aparelho");
    expect(result.unknownFields).toContain("linha sem chave");
    expect(result.metadata["FileInfo.CampoDesconhecido"]).toBe("42");
  });

  it("calcula sha256 e tamanho do arquivo original", async () => {
    const content = buffer(LABELED_FILE);
    const result = await parser.parse(content, "exame.awp");
    expect(result.file.size).toBe(content.length);
    expect(result.file.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("nunca marca o parsing como VERIFIED sem conferência oficial", async () => {
    const result = await parser.parse(buffer(LABELED_FILE), "exame.awp");
    expect(result.confidence).toBe("PARTIAL");
  });

  it("marca medição como inválida sem alterar valores quando PAS <= PAD", async () => {
    const content = [
      "FileVersion_Main=1",
      "1=Date:2024-09-13,Time:08:30,SYS:60,DIA:90,PR:70",
      "2=Date:2024-09-13,Time:09:00,SYS:127,DIA:70,PR:72",
    ].join("\n");

    const result = await parser.parse(buffer(content), "exame.awp");
    const invalid = result.measurements.find((measurement) => !measurement.valid);
    expect(invalid?.systolic).toBe(60);
    expect(invalid?.diastolic).toBe(90);
    expect(result.warnings.some((warning) => warning.code === "INVALID_MEASUREMENT")).toBe(true);
  });

  it("avisa quando a frequência cardíaca não está no registro", async () => {
    const content = [
      "FileVersion_Main=1",
      "1=Date:2024-09-13,Time:08:30,SYS:127,DIA:70",
    ].join("\n");

    const result = await parser.parse(buffer(content), "exame.awp");
    expect(result.measurements[0].heartRate).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === "MISSING_HEART_RATE")).toBe(true);
  });

  it("usa a ordem de campos somente quando declarada no arquivo", async () => {
    const declared = [
      "FileVersion_Main=1",
      "StartDate=2024-09-13",
      "DataFormat=Time,SYS,DIA,PR",
      "1=08:30,127,70,72",
      "2=23:30,112,63,60",
    ].join("\n");

    const result = await parser.parse(buffer(declared), "exame.awp");
    expect(result.measurements[0].systolic).toBe(127);
    expect(result.measurements[0].diastolic).toBe(70);
    expect(result.measurements[0].heartRate).toBe(72);
    expect(result.measurements[0].measuredAt.getDate()).toBe(13);
  });

  it("reconstrói a virada de dia quando os registros só trazem horário", async () => {
    const declared = [
      "FileVersion_Main=1",
      "StartDate=2024-09-13",
      "DataFormat=Time,SYS,DIA,PR",
      "1=23:30,127,70,72",
      "2=00:30,112,63,60",
    ].join("\n");

    const result = await parser.parse(buffer(declared), "exame.awp");
    expect(result.measurements[0].measuredAt.getDate()).toBe(13);
    expect(result.measurements[1].measuredAt.getDate()).toBe(14);
    expect(
      result.warnings.some((warning) => warning.code === "DATE_FROM_FILE_START_DATE"),
    ).toBe(true);
  });

  it("não datar registro sem data no registro e sem data no arquivo", async () => {
    const declared = [
      "FileVersion_Main=1",
      "DataFormat=Time,SYS,DIA,PR",
      "1=08:30,127,70,72",
    ].join("\n");

    await expect(parser.parse(buffer(declared), "exame.awp")).rejects.toThrow(
      NoMeasurementsFoundError,
    );
  });

  it("recusa registros posicionais sem declaração de colunas", async () => {
    const positional = ["FileVersion_Main=1", "1=08:30,127,70,72"].join("\n");
    await expect(parser.parse(buffer(positional), "exame.awp")).rejects.toThrow(
      NoMeasurementsFoundError,
    );
  });

  it("não interpreta registros hexadecimais sem layout de bytes confirmado", async () => {
    const hex = [
      "FileVersion_Main=1",
      "1=07E4090D081E007F0046",
      "2=07E4090D091E00840048",
    ].join("\n");

    await expect(parser.parse(buffer(hex), "exame.awp")).rejects.toThrow(
      NoMeasurementsFoundError,
    );
  });

  it("decodifica registros hexadecimais do AWP v2.0", async () => {
    const hex = [
      "FileVersion_Main=2",
      "FileVersion_Sub=0",
      "DeviceModel=ABPM50",
      "1=07EA0812080000007900440056004C0001000000000",
      "2=07E4090A131A00009200630073005B0001000000010",
    ].join("\n");

    const result = await parser.parse(buffer(hex), "exame.awp");

    expect(result.detectedFormat).toBe("contec-abpm50-ini-v2.0");
    expect(result.detectedVersion).toBe("2.0");
    expect(result.confidence).toBe("PARTIAL");
    expect(result.measurements).toHaveLength(2);

    const [first, second] = result.measurements;
    expect(first.systolic).toBe(121);
    expect(first.diastolic).toBe(68);
    expect(first.meanArterialPressure).toBe(86);
    expect(first.heartRate).toBe(76);
    expect(first.valid).toBe(true);

    expect(second.systolic).toBe(146);
    expect(second.diastolic).toBe(99);
    expect(second.meanArterialPressure).toBe(115);
    expect(second.heartRate).toBe(91);

    expect(result.rawRecords[0].status).toBe("DECODED");
    expect(result.rawRecords[0].decoderId).toBe("contec-awp-v2");
    expect(result.rawRecords[0].decoded?.rawTail).toBe("0001000000000");
  });

  it("decodifica estruturalmente todos os registros de um arquivo v2.0 com 81 medições", async () => {
    const sampleRecords = [
      "07EA0812080000007900440056004C0001000000000",
      "07E4090A131A00009200630073005B0001000000010",
    ];
    const lines = [
      "FileVersion_Main=2",
      "FileVersion_Sub=0",
      "DeviceModel=ABPM50",
      ...Array.from({ length: 81 }, (_, index) => {
        const record = sampleRecords[index % sampleRecords.length];
        return `${index + 1}=${record}`;
      }),
    ];

    const result = await parser.parse(buffer(lines.join("\n")), "exame-v2-81.awp");

    expect(result.measurements).toHaveLength(81);
    expect(result.rawRecords.filter((record) => record.status === "DECODED")).toHaveLength(81);
    expect(result.rawRecords.filter((record) => record.status === "UNDECODED")).toHaveLength(0);
  });

  it("resolve datas dd/mm somente com evidência no próprio arquivo", async () => {
    const content = [
      "FileVersion_Main=1",
      "1=Date:13/09/2024,Time:08:30,SYS:127,DIA:70,PR:72",
      "2=Date:14/09/2024,Time:09:00,SYS:132,DIA:75,PR:78",
    ].join("\n");

    const result = await parser.parse(buffer(content), "exame.awp");
    expect(result.measurements[0].measuredAt.getMonth()).toBe(8);
    expect(result.measurements[0].measuredAt.getDate()).toBe(13);
  });

  it("não interpreta datas ambíguas entre dia e mês", async () => {
    const content = [
      "FileVersion_Main=1",
      "1=Date:05/09/2024,Time:08:30,SYS:127,DIA:70,PR:72",
    ].join("\n");

    await expect(parser.parse(buffer(content), "exame.awp")).rejects.toThrow(
      NoMeasurementsFoundError,
    );
  });

  it("rejeita arquivo vazio", async () => {
    await expect(parser.parse(Buffer.alloc(0), "exame.awp")).rejects.toThrow(InvalidAwpFileError);
  });

  it("lê PATIENTDATA, horários do equipamento e comentários C{n} da fixture v2 anonimizada", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fixture = readFileSync(
      join(process.cwd(), "tests/fixtures/contec-abpm50/v2-patientdata-anon.awp"),
    );

    const result = await parser.parse(fixture, "v2-patientdata-anon.awp");

    expect(result.detectedFormat).toBe("contec-abpm50-ini-v2.0");
    expect(result.measurements).toHaveLength(81);

    expect(result.patientData).toEqual(
      expect.objectContaining({
        name: "PACIENTE ANONIMO",
        patientId: "ANON-001",
        age: 41,
        genderCode: 0,
        heightCm: 170,
        weightKg: 70,
        medications: "Losartana 50mg",
        race: undefined,
        address: undefined,
        phone: undefined,
        email: undefined,
      }),
    );
    expect(result.patientData?.birthday?.getFullYear()).toBe(1985);
    expect(result.patientData?.birthday?.getMonth()).toBe(2);
    expect(result.patientData?.birthday?.getDate()).toBe(15);

    expect(result.schedule).toEqual({
      awakeStart: "07:00",
      asleepStart: "22:00",
      awakeMeasurementIntervalMinutes: 15,
      asleepMeasurementIntervalMinutes: 30,
      source: "DEVICE_CONFIGURATION",
    });
    expect(result.sleepWindow).toEqual(
      expect.objectContaining({
        start: "22:00",
        end: "07:00",
        source: "DEVICE_CONFIGURATION",
      }),
    );
    expect(result.warnings.some((warning) => warning.code === "SLEEP_WINDOW_NOT_FOUND")).toBe(
      false,
    );

    const invalid = result.measurements.filter((measurement) => !measurement.valid);
    expect(invalid).toHaveLength(4);
    expect(invalid.map((measurement) => measurement.index).sort((a, b) => a - b)).toEqual([
      13, 14, 58, 59,
    ]);

    const byIndex = Object.fromEntries(
      invalid.map((measurement) => [measurement.index, measurement]),
    );
    expect(byIndex[13].deviceComment).toBe("Sem sinal");
    expect(byIndex[13].invalidReason).toBe("Sem sinal");
    expect(byIndex[14].invalidReason).toBe("Manguito frouxo");
    expect(byIndex[58].invalidReason).toBe("Manguito frouxo");
    expect(byIndex[59].invalidReason).toBe("Movimento excessivo");

    expect(byIndex[13].measuredAt.getHours()).toBe(20);
    expect(byIndex[13].measuredAt.getMinutes()).toBe(32);
    expect(byIndex[14].measuredAt.getMinutes()).toBe(35);
    expect(byIndex[58].measuredAt.getHours()).toBe(7);
    expect(byIndex[58].measuredAt.getMinutes()).toBe(15);
    expect(byIndex[59].measuredAt.getMinutes()).toBe(18);
  });
});
