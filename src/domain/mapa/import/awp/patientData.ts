import { findMetadata, metadataInSection } from "./AwpDocumentReader";
import type { AwpDocument, AwpPatientData } from "./types";

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  const text = emptyToUndefined(value);
  if (!text) return undefined;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalFloat(value: string | undefined): number | undefined {
  const text = emptyToUndefined(value);
  if (!text) return undefined;
  const normalized = text.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Datas observadas no CONTEC: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY.
 * Sem evidência de ordem ambígua, não inventa.
 */
function parseBirthday(value: string | undefined): Date | undefined {
  const text = emptyToUndefined(value);
  if (!text) return undefined;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return date;
    }
    return undefined;
  }

  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (day > 12 || month <= 12) {
      const date = new Date(year, month - 1, day);
      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }
    }
  }

  return undefined;
}

function sectionValue(
  fields: Record<string, string>,
  key: string,
): string | undefined {
  const found = Object.entries(fields).find(
    ([name]) => name.toLowerCase().replace(/[^a-z0-9]/g, "") === key.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  return found?.[1];
}

/**
 * Lê `[PATIENTDATA]` do AWP v2. Campos vazios viram undefined.
 * Gender do arquivo é código numérico; use {@link mapAwpGenderCode}.
 */
export function readPatientData(document: AwpDocument): AwpPatientData | undefined {
  const sectionFields = metadataInSection(document, "PATIENTDATA");
  const hasSection = Object.keys(sectionFields).length > 0;

  // Fallback: alguns exports usam as mesmas chaves fora de seção.
  const read = (key: string): string | undefined => {
    if (hasSection) return emptyToUndefined(sectionValue(sectionFields, key));
    return emptyToUndefined(findMetadata(document, [key])?.value);
  };

  const patient: AwpPatientData = {
    name: read("Name"),
    patientId: read("ID"),
    birthday: parseBirthday(read("Birthday")),
    age: parseOptionalInt(read("Age")),
    genderCode: parseOptionalInt(read("Gender")),
    heightCm: parseOptionalFloat(read("Height")),
    weightKg: parseOptionalFloat(read("Weight")),
    race: read("Race"),
    address: read("Addr"),
    phone: read("Phone"),
    email: read("Email"),
    medications: read("Medications"),
    referringPhysician: read("ReferringPhys"),
    interpretingPhysician: read("InterprettingPhys") ?? read("InterpretingPhys"),
    comments: read("Comments"),
    clinicalInterpretation: read("ClinicalInterp"),
    outpatientNumber: read("OutpatientNo"),
    admissionNumber: read("AdmissionNo"),
    bedNumber: read("BedNo"),
    departmentNumber: read("DepartmentNo"),
  };

  const hasAny = Object.values(patient).some((value) => value !== undefined);
  return hasAny ? patient : undefined;
}

/**
 * Mapeia o campo Gender do CONTEC ABPM50.
 * No software oficial o combo é 0 = masculino, 1 = feminino.
 */
export function mapAwpGenderCode(
  code: number | undefined,
): "M" | "F" | "OTHER" {
  if (code === 0) return "M";
  if (code === 1) return "F";
  return "OTHER";
}
