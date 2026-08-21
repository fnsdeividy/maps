import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { REPORT_PHRASES } from "../src/domain/mapa/config/phrases";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.AUTH_DOCTOR_EMAIL ?? "medico@local";
  const password = process.env.AUTH_DOCTOR_PASSWORD ?? "mapa123";
  const passwordHash = await bcrypt.hash(password, 10);

  // Aprovador: edita, aprova e devolve laudos com pendências.
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name: "Dr. Marcos Heber Lima",
      role: "DOCTOR",
      rqe: "37228",
    },
    create: {
      email,
      passwordHash,
      name: "Dr. Marcos Heber Lima",
      role: "DOCTOR",
      rqe: "37228",
    },
  });

  await prisma.user.updateMany({
    where: { role: "DOCTOR" },
    data: { rqe: "37228" },
  });

  // Operador: gera/importa laudos e envia para aprovação.
  const operatorEmail = process.env.AUTH_OPERATOR_EMAIL ?? "operador@local";
  const operatorPassword = process.env.AUTH_OPERATOR_PASSWORD ?? "mapa123";
  const operatorHash = await bcrypt.hash(operatorPassword, 10);
  await prisma.user.upsert({
    where: { email: operatorEmail },
    update: { passwordHash: operatorHash, role: "OPERATOR" },
    create: {
      email: operatorEmail,
      passwordHash: operatorHash,
      name: "Operador",
      role: "OPERATOR",
    },
  });

  for (const phrase of REPORT_PHRASES) {
    await prisma.reportPhrase.upsert({
      where: { code: phrase.code },
      update: {
        category: phrase.category,
        text: phrase.text,
        active: true,
      },
      create: {
        code: phrase.code,
        category: phrase.category,
        text: phrase.text,
        active: true,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async () => {
    console.error("Seed failed");
    await prisma.$disconnect();
    process.exit(1);
  });
