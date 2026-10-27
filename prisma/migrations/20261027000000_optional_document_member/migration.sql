-- Allow documents shared by the group without a specific member association.
ALTER TABLE "FamilyDocument" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "FamilyDocument" ALTER COLUMN "memberName" DROP NOT NULL;
ALTER TABLE "FamilyDocument" ADD CONSTRAINT "document_member_pair"
  CHECK (("memberId" IS NULL) = ("memberName" IS NULL));

CREATE OR REPLACE FUNCTION check_document_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."groupId" <> OLD."groupId" THEN RAISE EXCEPTION 'Document group is immutable'; END IF;
    IF NEW."memberId" IS NOT DISTINCT FROM OLD."memberId" THEN RETURN NEW; END IF;
  END IF;
  IF NEW."memberId" IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM "Member" WHERE "id" = NEW."memberId" AND "groupId" = NEW."groupId" FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document member must belong to group' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
