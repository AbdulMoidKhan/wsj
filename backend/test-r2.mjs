
import {
  S3Client,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const client = new S3Client({
  region: process.env.R2_REGION || 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function testR2() {
  try {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        MaxKeys: 10,
      })
    );

    console.log('✅ Cloudflare R2 connection successful!');
    console.log('Bucket:', process.env.R2_BUCKET_NAME);
    console.log('Files:', result.Contents?.map(file => ({
      name: file.Key,
      size: file.Size,
    })) || []);

  } catch (error) {
    console.error('❌ R2 connection failed:');
    console.error(error.message);
    process.exitCode = 1;
  }
}

testR2();
