-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "seeker_post_id" UUID;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_seeker_post_id_fkey" FOREIGN KEY ("seeker_post_id") REFERENCES "SeekerPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
