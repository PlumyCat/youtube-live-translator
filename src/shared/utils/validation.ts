/**
 * Validation utilities for URLs and file paths
 */

/**
 * Validates YouTube URL format
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
export function isValidYouTubeUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return false;
  }

  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }

    // Check hostname
    const validHosts = [
      'www.youtube.com',
      'youtube.com',
      'youtu.be',
      'm.youtube.com',
    ];

    if (!validHosts.includes(urlObj.hostname)) {
      return false;
    }

    // Check path and video ID
    if (urlObj.hostname === 'youtu.be') {
      // Format: https://youtu.be/VIDEO_ID
      const videoId = urlObj.pathname.slice(1);
      return /^[\w-]{11}$/.test(videoId);
    } else {
      // Format: https://youtube.com/watch?v=VIDEO_ID or /live/VIDEO_ID
      const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
      return !!videoId && /^[\w-]{11}$/.test(videoId);
    }
  } catch {
    return false;
  }
}

/**
 * Validates file path for security
 * Prevents path traversal and ensures absolute paths
 */
export function isValidFilePath(filePath: string): boolean {
  if (typeof filePath !== 'string' || filePath.trim().length === 0) {
    return false;
  }

  // Prevent path traversal
  if (filePath.includes('..')) {
    return false;
  }

  // Check for absolute path
  // Windows: C:\path or \\network\path
  // Unix: /path
  const isAbsolute = /^([A-Za-z]:\\|\\\\|\/)/i.test(filePath);

  return isAbsolute;
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!isValidYouTubeUrl(url)) {
    return null;
  }

  try {
    const urlObj = new URL(url);

    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.slice(1);
    } else {
      return urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || null;
    }
  } catch {
    return null;
  }
}
