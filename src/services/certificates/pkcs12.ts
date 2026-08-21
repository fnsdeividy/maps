import { createHash } from "node:crypto";
import forge from "node-forge";

export class CertificateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CertificateError";
  }
}

export type CertificateInfo = {
  commonName: string;
  issuer: string;
  notAfter: Date;
  notBefore: Date;
  thumbprint: string;
};

export type SignedPayload = CertificateInfo & {
  cmsBase64: string;
  payloadHash: string;
};

function asBinaryString(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("binary");
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function dnValue(
  attributes: Array<{ name?: string; shortName?: string; value?: unknown }>,
  name: string,
): string {
  const field = attributes.find(
    (item) => item.name === name || item.shortName === name,
  );
  return String(field?.value ?? "").trim();
}

function certificateInfo(cert: forge.pki.Certificate): CertificateInfo {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const thumbprint = sha256Hex(Buffer.from(der, "binary"));
  return {
    commonName: dnValue(cert.subject.attributes, "commonName") || "—",
    issuer: dnValue(cert.issuer.attributes, "commonName") || "—",
    notAfter: cert.validity.notAfter,
    notBefore: cert.validity.notBefore,
    thumbprint,
  };
}

export function openPkcs12(
  pfxBytes: Uint8Array,
  password: string,
): { key: forge.pki.PrivateKey; cert: forge.pki.Certificate } {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(asBinaryString(pfxBytes));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch {
    throw new CertificateError(
      "Não foi possível abrir o certificado. Confira o arquivo .pfx/.p12 e a senha.",
    );
  }

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ??
    [];

  const key = keyBags[0]?.key;
  const cert = certBags[0]?.cert;
  if (!key || !cert) {
    throw new CertificateError(
      "O arquivo não contém um certificado de assinatura com chave privada.",
    );
  }

  return { key, cert };
}

export function inspectPkcs12(
  pfxBytes: Uint8Array,
  password: string,
): CertificateInfo {
  const { cert } = openPkcs12(pfxBytes, password);
  const info = certificateInfo(cert);
  const now = new Date();
  if (now < info.notBefore || now > info.notAfter) {
    throw new CertificateError(
      "Este certificado está fora da validade e não pode ser usado.",
    );
  }
  return info;
}

export function signPayload(
  pfxBytes: Uint8Array,
  password: string,
  payload: string,
): SignedPayload {
  const { key, cert } = openPkcs12(pfxBytes, password);
  const info = certificateInfo(cert);
  const now = new Date();
  if (now < info.notBefore || now > info.notAfter) {
    throw new CertificateError(
      "Este certificado está fora da validade e não pode ser usado.",
    );
  }

  const payloadBytes = Buffer.from(payload, "utf8");
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(payload);
  p7.addCertificate(cert);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: now.toISOString() },
    ],
  });
  p7.sign();

  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return {
    ...info,
    cmsBase64: forge.util.encode64(der),
    payloadHash: sha256Hex(payloadBytes),
  };
}
