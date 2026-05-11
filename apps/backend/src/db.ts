import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

export async function pingDb(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 as ok`;
  return rows.length === 1;
}
