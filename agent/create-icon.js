/**
 * Generates a minimal valid .ico file with 16x16, 32x32, 48x48, and 256x256 icons.
 * Color: #00BFFF (Numbers10 brand cyan) on #1A1A2E dark background
 * Run: node create-icon.js
 * Output: renderer/icon.ico
 */

const fs = require('fs');
const path = require('path');

// Numbers10 brand cyan #00BFFF → BGRA (ICO uses BGRA byte order)
const B = 0xFF, G = 0xBF, R = 0x00, A = 0xff;
// Dark background #1A1A2E → BGRA
const bgB = 0x2E, bgG = 0x1A, bgR = 0x1A, bgA = 0xff;

function createBMPImage(size) {
  // BMP info header (BITMAPINFOHEADER) for ICO entry
  // ICO BMPs have height = 2 * size (image + mask)
  const headerSize = 40;
  const pixelCount = size * size;
  const bpp = 32; // bits per pixel (BGRA)
  const rowBytes = size * 4; // 32bpp, rows are already 4-byte aligned
  const pixelDataSize = rowBytes * size;
  // AND mask: 1bpp, rows padded to 4 bytes
  const maskRowBytes = Math.ceil(size / 32) * 4;
  const maskSize = maskRowBytes * size;
  const totalSize = headerSize + pixelDataSize + maskSize;

  const buf = Buffer.alloc(totalSize);
  let offset = 0;

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, offset);              // biSize
  buf.writeInt32LE(size, offset + 4);         // biWidth
  buf.writeInt32LE(size * 2, offset + 8);     // biHeight (2x for ICO: image + mask)
  buf.writeUInt16LE(1, offset + 12);          // biPlanes
  buf.writeUInt16LE(32, offset + 14);         // biBitCount
  buf.writeUInt32LE(0, offset + 16);          // biCompression (BI_RGB)
  buf.writeUInt32LE(pixelDataSize + maskSize, offset + 20); // biSizeImage
  buf.writeInt32LE(0, offset + 24);           // biXPelsPerMeter
  buf.writeInt32LE(0, offset + 28);           // biYPelsPerMeter
  buf.writeUInt32LE(0, offset + 32);          // biClrUsed
  buf.writeUInt32LE(0, offset + 36);          // biClrImportant
  offset += 40;

  // Pixel data (bottom-up rows, BGRA)
  // Draw dark background with cyan border
  const borderWidth = size <= 16 ? 1 : size <= 48 ? 2 : 4;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const isEdge = x < borderWidth || x >= size - borderWidth ||
                     y < borderWidth || y >= size - borderWidth;
      if (isEdge) {
        buf[offset++] = B;
        buf[offset++] = G;
        buf[offset++] = R;
        buf[offset++] = A;
      } else {
        buf[offset++] = bgB;
        buf[offset++] = bgG;
        buf[offset++] = bgR;
        buf[offset++] = bgA;
      }
    }
  }

  // Now draw "IT" text in white on top of the pixel data
  // We'll write directly into the pixel buffer region (after header)
  drawIT(buf, headerSize, size, borderWidth);

  // AND mask (all zeros = fully opaque)
  // Already zero-filled by Buffer.alloc

  return buf;
}

/**
 * Draws "IT" in white pixels onto the BMP pixel data.
 * BMP pixel data is bottom-up, so row 0 in buffer = bottom of image.
 */
function drawIT(buf, pixelOffset, size, borderWidth) {
  // Define "I" and "T" as bitmap patterns for different sizes
  const patterns = getLetterPatterns(size);
  if (!patterns) return; // too small for text

  const { I, T, letterH, letterIW, letterTW, gap, startY } = patterns;
  // Total width of "IT" = letterIW + gap + letterTW
  const totalW = letterIW + gap + letterTW;
  const startX = Math.floor((size - totalW) / 2);
  const iStartX = startX;
  const tStartX = startX + letterIW + gap;

  // Draw letter I
  drawLetter(buf, pixelOffset, size, I, iStartX, startY, letterIW, letterH);
  // Draw letter T
  drawLetter(buf, pixelOffset, size, T, tStartX, startY, letterTW, letterH);
}

function drawLetter(buf, pixelOffset, size, pattern, startX, startY, w, h) {
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      if (pattern[row][col]) {
        // Image Y coordinate (top-down)
        const imgY = startY + row;
        // BMP is bottom-up, so buffer row = size - 1 - imgY
        const bmpRow = size - 1 - imgY;
        const x = startX + col;
        const idx = pixelOffset + (bmpRow * size + x) * 4;
        buf[idx] = B;        // B (cyan)
        buf[idx + 1] = G;    // G
        buf[idx + 2] = R;    // R
        buf[idx + 3] = 0xff; // A
      }
    }
  }
}

function getLetterPatterns(size) {
  if (size === 16) {
    // 5px tall letters, I=3 wide, T=5 wide, gap=1
    return {
      letterH: 7, letterIW: 3, letterTW: 5, gap: 1, startY: 5,
      I: [
        [1, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 1],
      ],
      T: [
        [1, 1, 1, 1, 1],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
      ],
    };
  } else if (size === 32) {
    // Larger letters for 32x32
    return {
      letterH: 14, letterIW: 6, letterTW: 10, gap: 2, startY: 9,
      I: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
      ],
      T: [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
      ],
    };
  } else if (size === 48) {
    // Larger letters for 48x48
    return {
      letterH: 20, letterIW: 8, letterTW: 14, gap: 3, startY: 14,
      I: [
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1],
      ],
      T: [
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
      ],
    };
  }
  // For 256x256, generate the pattern programmatically
  if (size === 256) {
    // Scale up from a conceptual grid
    const letterH = 100;
    const letterIW = 30;
    const letterTW = 60;
    const gap = 12;
    const startY = 78;
    const serifH = 12;
    const stemW = 12;

    // Build I pattern
    const I = [];
    for (let r = 0; r < letterH; r++) {
      const row = new Array(letterIW).fill(0);
      if (r < serifH || r >= letterH - serifH) {
        row.fill(1);
      } else {
        const stemStart = Math.floor((letterIW - stemW) / 2);
        for (let c = stemStart; c < stemStart + stemW; c++) row[c] = 1;
      }
      I.push(row);
    }

    // Build T pattern
    const T = [];
    for (let r = 0; r < letterH; r++) {
      const row = new Array(letterTW).fill(0);
      if (r < serifH) {
        row.fill(1);
      } else {
        const stemStart = Math.floor((letterTW - stemW) / 2);
        for (let c = stemStart; c < stemStart + stemW; c++) row[c] = 1;
      }
      T.push(row);
    }

    return { letterH, letterIW, letterTW, gap, startY, I, T };
  }

  return null;
}

function createICO(sizes) {
  const images = sizes.map(size => createBMPImage(size));

  // ICO header: 6 bytes
  // ICO directory entries: 16 bytes each
  // Then image data
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * images.length;
  let dataOffset = headerSize + dirSize;

  // Calculate total size
  let totalSize = dataOffset;
  for (const img of images) {
    totalSize += img.length;
  }

  const ico = Buffer.alloc(totalSize);

  // ICO Header
  ico.writeUInt16LE(0, 0);       // reserved
  ico.writeUInt16LE(1, 2);       // type: 1 = ICO
  ico.writeUInt16LE(images.length, 4); // count

  // Directory entries
  let currentOffset = dataOffset;
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const entryOffset = headerSize + i * dirEntrySize;
    const imgData = images[i];

    ico.writeUInt8(size < 256 ? size : 0, entryOffset);      // width (0 = 256)
    ico.writeUInt8(size < 256 ? size : 0, entryOffset + 1);  // height (0 = 256)
    ico.writeUInt8(0, entryOffset + 2);                        // color palette
    ico.writeUInt8(0, entryOffset + 3);                        // reserved
    ico.writeUInt16LE(1, entryOffset + 4);                     // color planes
    ico.writeUInt16LE(32, entryOffset + 6);                    // bits per pixel
    ico.writeUInt32LE(imgData.length, entryOffset + 8);        // image size
    ico.writeUInt32LE(currentOffset, entryOffset + 12);        // offset to data

    // Copy image data
    imgData.copy(ico, currentOffset);
    currentOffset += imgData.length;
  }

  return ico;
}

// Generate the ICO with 16x16, 32x32, 48x48, and 256x256 sizes
const ico = createICO([16, 32, 48, 256]);
const outputPath = path.join(__dirname, 'renderer', 'icon.ico');
fs.writeFileSync(outputPath, ico);

console.log(`Icon created at: ${outputPath}`);
console.log(`File size: ${ico.length} bytes`);
console.log('Sizes included: 16x16, 32x32, 48x48, 256x256');
console.log('Color: #00BFFF (Numbers10 cyan) on #1A1A2E dark background');
