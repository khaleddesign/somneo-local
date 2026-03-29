import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { r2Client, R2_BUCKET } from "@/lib/backup/r2-client";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKETS = ["reports-files", "invoices-files", "study-files"];

async function listAllFiles(
  adminClient: any,
  bucket: string,
  path: string = "",
): Promise<string[]> {
  const { data, error } = await adminClient.storage
    .from(bucket)
    .list(path, { limit: 1000 });
  if (error || !data) return [];

  const files: string[] = [];
  for (const item of data) {
    if (!item.id) {
      // Folder -> recursive
      const subPath = path ? `${path}/${item.name}` : item.name;
      const subFiles = await listAllFiles(adminClient, bucket, subPath);
      files.push(...subFiles);
    } else {
      // File
      if (item.name !== ".emptyFolderPlaceholder") {
        files.push(path ? `${path}/${item.name}` : item.name);
      }
    }
  }
  return files;
}

async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (err: any) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    let totalCopied = 0;
    let totalFailed = 0;
    const errors: string[] = [];

    for (const bucket of BUCKETS) {
      const files = await listAllFiles(admin, bucket);

      for (const fileKey of files) {
        const r2Key = `${bucket}/${fileKey}`;
        const exists = await fileExistsInR2(r2Key);

        if (!exists) {
          try {
            const { data, error } = await admin.storage
              .from(bucket)
              .download(fileKey);
            if (error || !data) {
              console.log('[Backup]', { timestamp: new Date().toISOString(), bucket, file: fileKey, status: 'failed' });
              errors.push(
                `Failed to download ${bucket}/${fileKey}: ${error?.message || "Unknown error"}`,
              );
              totalFailed++;
              continue;
            }

            const arrayBuffer = await data.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await r2Client.send(
              new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: r2Key,
                Body: buffer,
                ContentType: data.type,
              }),
            );

            console.log('[Backup]', { timestamp: new Date().toISOString(), bucket, file: fileKey, status: 'copied' });
            totalCopied++;
          } catch (e: any) {
            console.log('[Backup]', { timestamp: new Date().toISOString(), bucket, file: fileKey, status: 'failed' });
            errors.push(`Failed to backup ${bucket}/${fileKey}: ${e.message}`);
            totalFailed++;
          }
        } else {
          console.log('[Backup]', { timestamp: new Date().toISOString(), bucket, file: fileKey, status: 'skipped' });
        }
      }
    }

    return NextResponse.json({
      success: true,
      copied: totalCopied,
      failed: totalFailed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error("[Backup Cron]", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 },
    );
  }
}
