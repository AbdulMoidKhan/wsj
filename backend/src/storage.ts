import {BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException, ServiceUnavailableException, ConflictException, ForbiddenException} from '@nestjs/common';
import {DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

/*
  Cloudflare R2 storage (S3-compatible).

  - Credentials come only from the environment (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ...) and are
    never logged or returned. The client is created lazily, so the API starts normally when R2 is
    not configured; storage calls then fail with 503.
  - Every object this service writes lives under a category prefix (blogs/, sliders/, ...).
    Read/delete helpers refuse keys outside those prefixes, so objects created elsewhere in the
    bucket can never be touched through this service.
  - Buffer uploads are accepted only when the file signature (magic bytes) matches the declared
    MIME type and the category allows it.
*/

export const MEDIA_CATEGORIES = ['blogs', 'sliders', 'use-cases', 'services', 'images', 'videos', 'static'] as const;
export type MediaCategory = typeof MEDIA_CATEGORIES[number];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const STATIC_TYPES = [...IMAGE_TYPES, 'application/pdf', 'font/woff2', 'font/woff'];
const MB = 1024 * 1024;

/** Allowed MIME types and maximum size per category. */
export const CATEGORY_RULES: Record<MediaCategory, {types: readonly string[]; maxBytes: number}> = {
  blogs: {types: IMAGE_TYPES, maxBytes: 15 * MB},
  sliders: {types: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: 200 * MB},
  'use-cases': {types: IMAGE_TYPES, maxBytes: 15 * MB},
  services: {types: IMAGE_TYPES, maxBytes: 15 * MB},
  images: {types: IMAGE_TYPES, maxBytes: 15 * MB},
  videos: {types: VIDEO_TYPES, maxBytes: 1024 * MB},
  static: {types: STATIC_TYPES, maxBytes: 25 * MB},
};

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'application/pdf': 'pdf', 'font/woff2': 'woff2', 'font/woff': 'woff',
};

/** Direct (server-side) uploads above this size should use a presigned URL instead. */
export const MAX_DIRECT_UPLOAD_BYTES = 100 * MB;
const PRESIGN_MIN_SECONDS = 60;
const PRESIGN_MAX_SECONDS = 3600;
const PRESIGN_DEFAULT_SECONDS = 900;

/** Detect a supported MIME type from the file signature; null when unrecognised. */
export function detectMimeType(b: Buffer): string | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.toString('ascii', 0, 6))) return 'image/gif';
  if (b.length >= 5 && b.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 4 && b.toString('ascii', 0, 4) === 'wOF2') return 'font/woff2';
  if (b.length >= 4 && b.toString('ascii', 0, 4) === 'wOFF') return 'font/woff';
  if (b.length >= 4 && b.readUInt32BE(0) === 0x1a45dfa3) return 'video/webm';
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4'; // isom, mp41, mp42, M4V, dash ...
  }
  return null;
}

/** Lowercase, ASCII-only, hyphenated file stem (no extension, no path), at most 60 chars. */
export function safeFileStem(originalName: string): string {
  const base = path.basename(String(originalName || '').replace(/\\/g, '/'));
  const stem = base.replace(/\.[^.]*$/, '');
  const clean = stem.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return clean || 'file';
}

export function isMediaCategory(value: unknown): value is MediaCategory {
  return typeof value === 'string' && (MEDIA_CATEGORIES as readonly string[]).includes(value);
}

/** Unique object key: <category>/<yyyy>/<mm>/<uuid>-<safe-name>.<ext> */
export function buildObjectKey(category: MediaCategory, originalName: string, contentType: string, now = new Date()): string {
  const ext = EXTENSIONS[contentType];
  if (!ext) throw new BadRequestException('Unsupported content type');
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${category}/${yyyy}/${mm}/${randomUUID()}-${safeFileStem(originalName)}.${ext}`;
}

/** Throws unless the key is a well-formed key inside one of this service's category prefixes. */
export function assertManagedKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0 || key.length > 512) throw new BadRequestException('Invalid object key');
  const segments = key.split('/');
  if (!isMediaCategory(segments[0]) || segments.length < 2) throw new ForbiddenException('Object key is outside the managed storage prefixes');
  if (segments.some(s => s === '' || s === '.' || s === '..') || /[\u0000-\u001f\u007f\\]/.test(key)) throw new BadRequestException('Invalid object key');
  return key;
}

function assertAllowed(category: MediaCategory, contentType: string, size: number) {
  if (!isMediaCategory(category)) throw new BadRequestException('Unknown media category');
  const rules = CATEGORY_RULES[category];
  if (!rules.types.includes(contentType)) throw new BadRequestException(`Content type ${contentType} is not allowed for ${category}`);
  if (!Number.isInteger(size) || size <= 0) throw new BadRequestException('File is empty');
  if (size > rules.maxBytes) throw new BadRequestException(`File exceeds the ${Math.round(rules.maxBytes / MB)} MB limit for ${category}`);
}

interface R2Config {bucket: string; publicUrl: string; endpoint: string; region: string; accessKeyId: string; secretAccessKey: string}

export interface UploadFileInput {
  category: MediaCategory;
  buffer: Buffer;
  originalName: string;
  /** Declared MIME type (e.g. multer's file.mimetype); must match the file signature. */
  contentType: string;
  cacheControl?: string;
}
export interface StoredObject {key: string; url: string; size: number; contentType: string; etag?: string}
export interface PresignedUpload {key: string; uploadUrl: string; publicUrl: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string}
export interface FileMetadata {key: string; size: number; contentType?: string; etag?: string; lastModified?: string; cacheControl?: string; metadata: Record<string, string>}
export interface DeleteOptions {
  /** Return true when the key is still referenced (e.g. by a Media row or page content). Required. */
  isReferenced: (key: string) => Promise<boolean> | boolean;
}

/** Keys are unique, so stored objects are immutable and safe to cache for a year. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client | null = null;
  private config: R2Config | null = null;

  /** True when every required R2 variable is present (values are never exposed). */
  isConfigured(): boolean {
    try { this.getConfig(); return true; } catch { return false; }
  }

  private getConfig(): R2Config {
    if (this.config) return this.config;
    const env = (name: string) => process.env[name]?.trim() || '';
    const accountId = env('R2_ACCOUNT_ID');
    const endpoint = env('R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    const required: Record<string, string> = {
      R2_ACCESS_KEY_ID: env('R2_ACCESS_KEY_ID'), R2_SECRET_ACCESS_KEY: env('R2_SECRET_ACCESS_KEY'),
      R2_BUCKET_NAME: env('R2_BUCKET_NAME'), R2_PUBLIC_URL: env('R2_PUBLIC_URL'), 'R2_ENDPOINT (or R2_ACCOUNT_ID)': endpoint,
    };
    const missing = Object.keys(required).filter(k => !required[k]);
    if (missing.length) throw new ServiceUnavailableException(`Object storage is not configured (missing ${missing.join(', ')})`);
    let publicUrl: URL;
    try { publicUrl = new URL(required.R2_PUBLIC_URL); } catch { throw new ServiceUnavailableException('Object storage is not configured (R2_PUBLIC_URL is not a URL)'); }
    if (publicUrl.protocol !== 'https:' && process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('R2_PUBLIC_URL must use https in production');
    this.config = {
      bucket: required.R2_BUCKET_NAME, endpoint, region: env('R2_REGION') || 'auto',
      publicUrl: publicUrl.toString().replace(/\/+$/, ''),
      accessKeyId: required.R2_ACCESS_KEY_ID, secretAccessKey: required.R2_SECRET_ACCESS_KEY,
    };
    return this.config;
  }

  private getClient(): S3Client {
    if (this.client) return this.client;
    const c = this.getConfig();
    this.client = new S3Client({region: c.region, endpoint: c.endpoint, credentials: {accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey}});
    return this.client;
  }

  /** Map SDK errors to HTTP errors without leaking request details or credentials. */
  private fail(operation: string, error: unknown): never {
    const e = error as S3ServiceException;
    const name = e?.name || 'Error';
    const status = e?.$metadata?.httpStatusCode;
    this.logger.error(`R2 ${operation} failed: ${name}${status ? ' (HTTP ' + status + ')' : ''}`);
    if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) throw new NotFoundException('Object not found');
    if (status === 403 || name === 'AccessDenied') throw new ServiceUnavailableException('Object storage rejected the request');
    throw new InternalServerErrorException('Object storage request failed');
  }

  /** Public URL for a key (each path segment percent-encoded). Does not check existence. */
  getPublicUrl(key: string): string {
    assertManagedKey(key);
    return this.getConfig().publicUrl + '/' + key.split('/').map(encodeURIComponent).join('/');
  }

  /** Validate (category, MIME type, signature, size) and upload a buffer under a new unique key. */
  async uploadFile(input: UploadFileInput): Promise<StoredObject> {
    const {category, buffer} = input;
    if (!Buffer.isBuffer(buffer)) throw new BadRequestException('File required');
    if (buffer.length > MAX_DIRECT_UPLOAD_BYTES) throw new BadRequestException('File too large for direct upload; use a presigned upload URL');
    const declared = String(input.contentType || '').toLowerCase().split(';')[0].trim();
    assertAllowed(category, declared, buffer.length);
    const detected = detectMimeType(buffer);
    if (detected !== declared) throw new BadRequestException('File content does not match its declared type');
    const key = buildObjectKey(category, input.originalName, declared);
    const c = this.getConfig();
    try {
      const result = await this.getClient().send(new PutObjectCommand({
        Bucket: c.bucket, Key: key, Body: buffer, ContentType: declared, ContentLength: buffer.length,
        CacheControl: input.cacheControl || IMMUTABLE_CACHE,
        // x-amz-meta-* headers must be ASCII; keep the sanitised name only.
        Metadata: {'original-name': safeFileStem(input.originalName), category},
        IfNoneMatch: '*', // never overwrite an existing object
      }));
      return {key, url: this.getPublicUrl(key), size: buffer.length, contentType: declared, etag: result.ETag?.replace(/"/g, '')};
    } catch (error) {
      if ((error as S3ServiceException)?.$metadata?.httpStatusCode === 412) throw new ConflictException('Object already exists');
      this.fail('upload', error);
    }
  }

  /** True when the object exists; false on 404. Other failures throw. */
  async fileExists(key: string): Promise<boolean> {
    assertManagedKey(key);
    try {
      await this.getClient().send(new HeadObjectCommand({Bucket: this.getConfig().bucket, Key: key}));
      return true;
    } catch (error) {
      const e = error as S3ServiceException;
      if (e?.name === 'NotFound' || e?.$metadata?.httpStatusCode === 404) return false;
      this.fail('head', error);
    }
  }

  /** Size, type, ETag, timestamps and user metadata of an object (404 when missing). */
  async getFileMetadata(key: string): Promise<FileMetadata> {
    assertManagedKey(key);
    try {
      const h = await this.getClient().send(new HeadObjectCommand({Bucket: this.getConfig().bucket, Key: key}));
      return {key, size: h.ContentLength ?? 0, contentType: h.ContentType, etag: h.ETag?.replace(/"/g, ''), lastModified: h.LastModified?.toISOString(), cacheControl: h.CacheControl, metadata: h.Metadata || {}};
    } catch (error) { this.fail('metadata', error); }
  }

  /**
   * Delete one object. The caller must have already authorised the user (e.g. ADMIN/EDITOR) and
   * must supply `isReferenced`; the delete is refused while the key is still in use. Keys outside
   * the managed category prefixes are always refused. Missing objects return {deleted:false}.
   */
  async deleteFile(key: string, options: DeleteOptions): Promise<{key: string; deleted: boolean}> {
    assertManagedKey(key);
    if (typeof options?.isReferenced !== 'function') throw new BadRequestException('A reference check is required before deleting');
    if (await options.isReferenced(key)) throw new ConflictException('Object is still referenced and cannot be deleted');
    if (!(await this.fileExists(key))) return {key, deleted: false};
    try {
      await this.getClient().send(new DeleteObjectCommand({Bucket: this.getConfig().bucket, Key: key}));
      return {key, deleted: true};
    } catch (error) { this.fail('delete', error); }
  }

  /**
   * Short-lived URL for a browser to PUT a (large) file straight to R2. The signature binds the
   * key, Content-Type and Content-Length, so the client must send exactly the returned headers.
   * The bytes are not inspected by the API: verify the object (getFileMetadata) before recording it.
   */
  async generatePresignedUploadUrl(input: {category: MediaCategory; originalName: string; contentType: string; contentLength: number; expiresInSeconds?: number}): Promise<PresignedUpload> {
    const declared = String(input.contentType || '').toLowerCase().split(';')[0].trim();
    assertAllowed(input.category, declared, input.contentLength);
    const expiresIn = Math.min(PRESIGN_MAX_SECONDS, Math.max(PRESIGN_MIN_SECONDS, Math.floor(input.expiresInSeconds ?? PRESIGN_DEFAULT_SECONDS)));
    const key = buildObjectKey(input.category, input.originalName, declared);
    const c = this.getConfig();
    try {
      const uploadUrl = await getSignedUrl(this.getClient(), new PutObjectCommand({
        Bucket: c.bucket, Key: key, ContentType: declared, ContentLength: input.contentLength, CacheControl: IMMUTABLE_CACHE,
      }), {expiresIn, signableHeaders: new Set(['content-type', 'content-length'])});
      return {
        key, uploadUrl, publicUrl: this.getPublicUrl(key), method: 'PUT',
        headers: {'Content-Type': declared, 'Content-Length': String(input.contentLength), 'Cache-Control': IMMUTABLE_CACHE},
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      };
    } catch (error) { this.fail('presign', error); }
  }
}
