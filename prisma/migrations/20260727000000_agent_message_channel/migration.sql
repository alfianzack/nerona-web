-- AlterTable
ALTER TABLE "agent_messages" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "agent_messages" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'whatsapp';
