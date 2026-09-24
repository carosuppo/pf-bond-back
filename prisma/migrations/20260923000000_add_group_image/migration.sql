ALTER TABLE "Group" ADD COLUMN "image" TEXT NOT NULL DEFAULT '/images/default-group.png';

ALTER TABLE "Group" ALTER COLUMN "image" DROP DEFAULT;
