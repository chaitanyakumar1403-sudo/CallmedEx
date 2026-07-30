"use client";
/**
 * Route alias — the database stores role as "processing_center" (underscore)
 * but the canonical Next.js folder is "processing-center" (hyphen).
 * This page ensures /dashboard/processing_center resolves without a 404.
 */
export { default } from "../processing-center/page";
