import { prisma } from "./prisma";

export interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

const KEYS: Record<keyof PaymentSettings, string> = {
  bankName: "bank_name",
  accountNumber: "bank_account_number",
  accountHolder: "bank_account_holder",
  instructions: "bank_instructions",
};

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(KEYS) } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return {
    bankName: map.get(KEYS.bankName) ?? "",
    accountNumber: map.get(KEYS.accountNumber) ?? "",
    accountHolder: map.get(KEYS.accountHolder) ?? "",
    instructions: map.get(KEYS.instructions) ?? "",
  };
}

export function isPaymentConfigured(settings: PaymentSettings): boolean {
  return Boolean(settings.bankName && settings.accountNumber && settings.accountHolder);
}

export async function updatePaymentSettings(values: PaymentSettings): Promise<void> {
  await prisma.$transaction(
    (Object.keys(KEYS) as (keyof PaymentSettings)[]).map((field) =>
      prisma.setting.upsert({
        where: { key: KEYS[field] },
        create: { key: KEYS[field], value: values[field] ?? "" },
        update: { value: values[field] ?? "" },
      })
    )
  );
}
