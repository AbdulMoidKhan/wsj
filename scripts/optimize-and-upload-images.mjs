#!/usr/bin/env node
/**
 * Image Optimization and R2 Upload Script
 * 
 * This script:
 * 1. Converts large JPG/PNG images to optimized WebP
 * 2. Optimizes SVG files
 * 3. Uploads all images to Cloudflare R2
 * 4. Generates a mapping file for updating references
 * 5. Identifies and removes duplicate/irrelevant images
 */

import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { optimize } from 'svgo';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
const envPath = path.join(__dirname, '..', 'backend', '.env');
dotenv.config({ path: envPath });

// R2 Configuration
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  endpoint: process.env.R2_ENDPOINT,
  publicUrl: process.env.R2_PUBLIC_URL,
  region: process.env.R2_REGION || 'auto'
};

// Validate configuration
if (!R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey || !R2_CONFIG.bucketName) {
  console.error('❌ Missing R2 configuration. Please check backend/.env file.');
  process.exit(1);
}

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: R2_CONFIG.region,
  endpoint: R2_CONFIG.endpoint,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey
  }
});

// Paths
const PROJECT_ROOT = path.join(__dirname, '..');
const MEDIA_DIR = path.join(PROJECT_ROOT, 'public', 'media');
const OPTIMIZED_DIR = path.join(PROJECT_ROOT, 'public', 'media-optimized');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'scripts', 'output');

// Image optimization settings
const OPTIMIZATION = {
  webp: {
    quality: 85,
    effort: 6
  },
  jpeg: {
    quality: 85,
    progressive: true
  },
  png: {
    quality: 85,
    compressionLevel: 9
  },
  maxWidth: 2560, // UHD support
  maxHeight: 1440
};

// File size thresholds (in bytes)
const SIZE_THRESHOLDS = {
  convertToWebP: 100 * 1024, // 100KB - convert JPG/PNG to WebP if larger
  skipUpload: 10 * 1024 * 1024 // 10MB - skip files larger than this
};

/**
 * Calculate file hash for deduplication
 */
async function getFileHash(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

/**
 * Optimize image based on type
 */
async function optimizeImage(inputPath, outputPath, fileExt) {
  const stats = await fs.stat(inputPath);
  const fileSize = stats.size;

  try {
    if (fileExt === '.svg') {
      // Optimize SVG
      const svgContent = await fs.readFile(inputPath, 'utf-8');
      const result = optimize(svgContent, {
        multipass: true,
        plugins: [
          'removeDoctype',
          'removeXMLProcInst',
          'removeComments',
          'removeMetadata',
          'removeUselessDefs',
          'removeEditorsNSData',
          'removeEmptyAttrs',
          'removeHiddenElems',
          'removeEmptyText',
          'removeEmptyContainers',
          'cleanupEnableBackground',
          'minifyStyles',
          'convertStyleToAttrs',
          'convertColors',
          'convertPathData',
          'convertTransform',
          'removeUnknownsAndDefaults',
          'removeUselessStrokeAndFill',
          'cleanupIDs',
          'mergePaths',
          'convertShapeToPath',
          'sortAttrs',
          'removeDimensions'
        ]
      });
      await fs.writeFile(outputPath, result.data);
      return { optimized: true, size: result.data.length };
    }

    // For raster images
    let image = sharp(inputPath);
    const metadata = await image.metadata();

    // Resize if too large (maintain aspect ratio)
    if (metadata.width > OPTIMIZATION.maxWidth || metadata.height > OPTIMIZATION.maxHeight) {
      image = image.resize(OPTIMIZATION.maxWidth, OPTIMIZATION.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert large JPG/PNG to WebP
    if (['.jpg', '.jpeg', '.png'].includes(fileExt) && fileSize > SIZE_THRESHOLDS.convertToWebP) {
      const webpPath = outputPath.replace(/\.(jpe?g|png)$/i, '.webp');
      await image
        .webp(OPTIMIZATION.webp)
        .toFile(webpPath);
      
      const newStats = await fs.stat(webpPath);
      return { optimized: true, converted: 'webp', path: webpPath, size: newStats.size };
    }

    // Optimize in original format
    if (fileExt === '.webp') {
      await image.webp(OPTIMIZATION.webp).toFile(outputPath);
    } else if (['.jpg', '.jpeg'].includes(fileExt)) {
      await image.jpeg(OPTIMIZATION.jpeg).toFile(outputPath);
    } else if (fileExt === '.png') {
      await image.png(OPTIMIZATION.png).toFile(outputPath);
    } else {
      // Copy unsupported formats as-is
      await fs.copyFile(inputPath, outputPath);
    }

    const newStats = await fs.stat(outputPath);
    return { optimized: true, size: newStats.size };
  } catch (error) {
    console.error(`Error optimizing ${path.basename(inputPath)}:`, error.message);
    // Copy original on error
    await fs.copyFile(inputPath, outputPath);
    return { optimized: false, error: error.message };
  }
}

/**
 * Upload file to R2
 */
async function uploadToR2(filePath, key) {
  try {
    // Check if file already exists
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key
      }));
      console.log(`  ⏭️  Skipped (already exists): ${key}`);
      return { uploaded: false, exists: true };
    } catch (err) {
      // File doesn't exist, proceed with upload
    }

    const fileBuffer = await fs.readFile(filePath);
    const contentType = getContentType(path.extname(filePath));

    await s3Client.send(new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000' // 1 year cache
    }));

    console.log(`  ✅ Uploaded: ${key}`);
    return { uploaded: true, url: `${R2_CONFIG.publicUrl}/${key}` };
  } catch (error) {
    console.error(`  ❌ Upload failed for ${key}:`, error.message);
    return { uploaded: false, error: error.message };
  }
}

/**
 * Get MIME content type
 */
function getContentType(ext) {
  const types = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.gif': 'image/gif'
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Main processing function
 */
async function main() {
  console.log('🚀 Starting image optimization and R2 upload...\n');
  console.log(`📁 Source: ${MEDIA_DIR}`);
  console.log(`📦 Bucket: ${R2_CONFIG.bucketName}\n`);

  // Create output directories
  await fs.mkdir(OPTIMIZED_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Get all image files
  const files = await fs.readdir(MEDIA_DIR);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'].includes(ext);
  });

  console.log(`📸 Found ${imageFiles.length} images\n`);

  const results = {
    total: imageFiles.length,
    optimized: 0,
    uploaded: 0,
    skipped: 0,
    errors: 0,
    duplicates: [],
    mapping: {}
  };

  const hashes = new Map();

  // Process each image
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const inputPath = path.join(MEDIA_DIR, file);
    const fileExt = path.extname(file).toLowerCase();
    
    console.log(`[${i + 1}/${imageFiles.length}] Processing: ${file}`);

    try {
      // Check file size
      const stats = await fs.stat(inputPath);
      if (stats.size > SIZE_THRESHOLDS.skipUpload) {
        console.log(`  ⚠️  Skipped (too large): ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        results.skipped++;
        continue;
      }

      // Check for duplicates
      const hash = await getFileHash(inputPath);
      if (hashes.has(hash)) {
        const original = hashes.get(hash);
        console.log(`  🔄 Duplicate of: ${original}`);
        results.duplicates.push({ file, original });
        results.skipped++;
        continue;
      }
      hashes.set(hash, file);

      // Optimize image
      const outputFileName = file;
      const outputPath = path.join(OPTIMIZED_DIR, outputFileName);
      
      const optimizationResult = await optimizeImage(inputPath, outputPath, fileExt);
      
      if (optimizationResult.optimized) {
        results.optimized++;
        const originalSize = stats.size;
        const newSize = optimizationResult.size;
        const savings = ((1 - newSize / originalSize) * 100).toFixed(1);
        console.log(`  📉 Optimized: ${(originalSize / 1024).toFixed(1)}KB → ${(newSize / 1024).toFixed(1)}KB (${savings}% reduction)`);
      }

      // Upload to R2
      const finalPath = optimizationResult.converted ? optimizationResult.path : outputPath;
      const finalFileName = path.basename(finalPath);
      const r2Key = `static/${finalFileName}`;
      
      const uploadResult = await uploadToR2(finalPath, r2Key);
      
      if (uploadResult.uploaded) {
        results.uploaded++;
        results.mapping[file] = {
          original: `/media/${file}`,
          optimized: `/media/${finalFileName}`,
          r2: uploadResult.url,
          r2Key: r2Key
        };
      } else if (uploadResult.exists) {
        results.mapping[file] = {
          original: `/media/${file}`,
          optimized: `/media/${finalFileName}`,
          r2: `${R2_CONFIG.publicUrl}/${r2Key}`,
          r2Key: r2Key
        };
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      results.errors++;
    }

    console.log('');
  }

  // Save results
  const reportPath = path.join(OUTPUT_DIR, 'optimization-report.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

  // Save duplicates list
  if (results.duplicates.length > 0) {
    const duplicatesPath = path.join(OUTPUT_DIR, 'duplicates.txt');
    const duplicatesList = results.duplicates
      .map(d => `${d.file} → duplicate of ${d.original}`)
      .join('\n');
    await fs.writeFile(duplicatesPath, duplicatesList);
  }

  // Print summary
  console.log('═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total images:        ${results.total}`);
  console.log(`Optimized:           ${results.optimized}`);
  console.log(`Uploaded to R2:      ${results.uploaded}`);
  console.log(`Skipped:             ${results.skipped}`);
  console.log(`Duplicates found:    ${results.duplicates.length}`);
  console.log(`Errors:              ${results.errors}`);
  console.log('═'.repeat(60));
  console.log(`\n📄 Report saved: ${reportPath}`);
  
  if (results.duplicates.length > 0) {
    console.log(`📄 Duplicates list: ${path.join(OUTPUT_DIR, 'duplicates.txt')}`);
  }

  console.log('\n✨ Done!');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
