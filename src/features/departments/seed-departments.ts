import { DEFAULT_DEPARTMENTS } from "@/features/departments/default-departments";

type DepartmentSeedStore = {
  department: {
    upsert(args: {
      where: { code: string };
      update: { name: string; isActive: boolean };
      create: { code: string; name: string; isActive: boolean };
    }): Promise<unknown>;
  };
};

export async function seedDepartments(store: DepartmentSeedStore) {
  for (const department of DEFAULT_DEPARTMENTS) {
    await store.department.upsert({
      where: { code: department.code },
      update: { name: department.name, isActive: true },
      create: { ...department, isActive: true },
    });
  }
}
