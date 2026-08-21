import { describe, expect, it } from "vitest";
import forge from "node-forge";
import {
  CertificateError,
  inspectPkcs12,
  signPayload,
} from "./pkcs12";

function makeTestPfx(password: string, valid = true): Uint8Array {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  const now = new Date();
  cert.validity.notBefore = new Date(now.getTime() - 60_000);
  cert.validity.notAfter = new Date(
    now.getTime() + (valid ? 365 : -1) * 24 * 60 * 60 * 1000,
  );
  const attrs = [
    { name: "commonName", value: "MARCOS HEBER LIMA:00000000000" },
    { name: "countryName", value: "BR" },
    { name: "organizationName", value: "ICP-Brasil Test" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, "binary");
}

describe("certificado PKCS#12", () => {
  it("lê o titular e assina um payload", () => {
    const pfx = makeTestPfx("mapa-teste");
    const info = inspectPkcs12(pfx, "mapa-teste");
    expect(info.commonName).toContain("MARCOS HEBER LIMA");

    const signed = signPayload(pfx, "mapa-teste", '{"id":"laudo-1"}');
    expect(signed.payloadHash).toHaveLength(64);
    expect(signed.cmsBase64.length).toBeGreaterThan(100);
    expect(signed.thumbprint).toBe(info.thumbprint);
  });

  it("rejeita senha incorreta", () => {
    const pfx = makeTestPfx("mapa-teste");
    expect(() => inspectPkcs12(pfx, "errada")).toThrow(CertificateError);
  });
});
