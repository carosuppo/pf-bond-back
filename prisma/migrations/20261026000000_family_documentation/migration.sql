-- CreateTable
-- A membership can be deleted without deleting the group's documents. Keep its
-- historical id/name, but enforce same-group membership for every NEW association.
CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyDocument" (
    "id" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "memberName" TEXT NOT NULL,
    "folderId" TEXT,
    "name" VARCHAR(200) NOT NULL,
    "objectPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentObject" (
    "path" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "DocumentObject_pkey" PRIMARY KEY ("path")
);

-- CreateIndex
CREATE INDEX "DocumentFolder_groupId_parentId_idx" ON "DocumentFolder"("groupId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFolder_id_groupId_key" ON "DocumentFolder"("id", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyDocument_objectPath_key" ON "FamilyDocument"("objectPath");

-- CreateIndex
CREATE INDEX "FamilyDocument_groupId_folderId_idx" ON "FamilyDocument"("groupId", "folderId");

-- CreateIndex
CREATE INDEX "FamilyDocument_groupId_memberId_idx" ON "FamilyDocument"("groupId", "memberId");

-- CreateIndex
CREATE INDEX "DocumentObject_state_createdAt_idx" ON "DocumentObject"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_parentId_groupId_fkey" FOREIGN KEY ("parentId", "groupId") REFERENCES "DocumentFolder"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_folderId_groupId_fkey" FOREIGN KEY ("folderId", "groupId") REFERENCES "DocumentFolder"("id", "groupId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_objectPath_fkey" FOREIGN KEY ("objectPath") REFERENCES "DocumentObject"("path") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FamilyDocument" ADD CONSTRAINT "document_size" CHECK ("size" > 0 AND "size" <= 10485760);
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "document_mime" CHECK ("mimeType" IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp'));
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "document_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "DocumentFolder" ADD CONSTRAINT "folder_name" CHECK (length(trim("name")) > 0);
ALTER TABLE "DocumentObject" ADD CONSTRAINT "object_state" CHECK ("state" IN ('pending', 'active', 'retired'));

CREATE FUNCTION check_document_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."groupId" <> OLD."groupId" THEN RAISE EXCEPTION 'Document group is immutable'; END IF;
    IF NEW."memberId" = OLD."memberId" THEN RETURN NEW; END IF;
  END IF;
  PERFORM 1 FROM "Member" WHERE "id" = NEW."memberId" AND "groupId" = NEW."groupId" FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document member must belong to group' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_member_check BEFORE INSERT OR UPDATE ON "FamilyDocument" FOR EACH ROW EXECUTE FUNCTION check_document_member();

-- Folder parent/group are immutable: renaming cannot create cycles or move trees.
CREATE FUNCTION check_document_folder() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."groupId" <> OLD."groupId" OR NEW."parentId" IS DISTINCT FROM OLD."parentId" THEN
    RAISE EXCEPTION 'Folder parent and group are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_folder_check BEFORE UPDATE ON "DocumentFolder" FOR EACH ROW EXECUTE FUNCTION check_document_folder();

-- Also covers cascades from account/group deletion outside this module.
CREATE FUNCTION retire_document_object() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "DocumentObject" SET "state" = 'retired', "retiredAt" = CURRENT_TIMESTAMP WHERE "path" = OLD."objectPath";
  RETURN OLD;
END $$;
CREATE TRIGGER retire_deleted_document AFTER DELETE ON "FamilyDocument" FOR EACH ROW EXECUTE FUNCTION retire_document_object();
