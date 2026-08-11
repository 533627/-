import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedDepartments } from "../src/features/departments/seed-departments";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const adapter = new PrismaPg({ connectionString });
const database = new PrismaClient({ adapter });

try {
  await seedDepartments(database);
} finally {
  await database.$disconnect();
}
