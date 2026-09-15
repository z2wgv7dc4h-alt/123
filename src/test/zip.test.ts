import { describe, expect, it } from 'vitest';
import { buildZip, blobToUint8 } from '../core/export/zip';

// Copy of the crc32 function from zip.ts for testing
function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

// Helper to read little-endian values from Uint8Array
function readUInt16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readUInt32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24);
}

describe('zip export CRC integrity', () => {
  it('verifies CRC-32 in local and central headers matches payload', async () => {
    const data1 = new TextEncoder().encode('hello');
    const data2 = new TextEncoder().encode('world');
    const entries = [
      { name: 'a.txt', data: data1 },
      { name: 'b.txt', data: data2 },
    ];

    const expectedCrc1 = crc32(data1);
    const expectedCrc2 = crc32(data2);

    const zip = buildZip(entries);
    const buf = new Uint8Array(await zip.arrayBuffer());

    // Find the end of central directory record (0x06054b50)
    let endOfCentralOffset = -1;
    for (let i = 0; i < buf.length - 3; i++) {
      if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
        endOfCentralOffset = i;
        break;
      }
    }

    expect(endOfCentralOffset).toBeGreaterThanOrEqual(0);

    // Parse end of central directory record
    const totalCentralEntries = readUInt16LE(buf, endOfCentralOffset + 8);
    const centralDirectoryOffset = readUInt32LE(buf, endOfCentralOffset + 16);

    // Parse central directory headers
    let offset = centralDirectoryOffset;
    const centralCrcs: number[] = [];

    for (let i = 0; i < totalCentralEntries; i++) {
      // Central directory header signature
      if (buf[offset] !== 0x50 || buf[offset + 1] !== 0x4b || buf[offset + 2] !== 0x01 || buf[offset + 3] !== 0x02) {
        throw new Error(`Invalid central directory header signature at offset ${offset}`);
      }
      // CRC-32 is at offset 16 (relative to central header start)
      const crc = readUInt32LE(buf, offset + 16);
      centralCrcs.push(crc);

      // Move to the next central directory header
      const nameLength = readUInt16LE(buf, offset + 28);
      const extraLength = readUInt16LE(buf, offset + 30);
      const commentLength = readUInt16LE(buf, offset + 32);
      const headerSize = 46 + nameLength + extraLength + commentLength;
      offset += headerSize;
    }

    // Parse local file headers
    offset = 0;
    const localCrcs: number[] = [];

    for (let i = 0; i < entries.length; i++) {
      // Local file header signature
      if (buf[offset] !== 0x50 || buf[offset + 1] !== 0x4b || buf[offset + 2] !== 0x03 || buf[offset + 3] !== 0x04) {
        throw new Error(`Invalid local file header signature at offset ${offset}`);
      }
      // CRC-32 is at offset 14 (relative to local header start)
      const crc = readUInt32LE(buf, offset + 14);
      localCrcs.push(crc);

      // Move past the local header
      const nameLength = readUInt16LE(buf, offset + 26);
      const extraLength = readUInt16LE(buf, offset + 28);
      const headerSize = 30 + nameLength + extraLength;
      offset += headerSize;

      // Skip the file data
      offset += entries[i].data.length;
    }

    // Expect that we have two entries
    expect(localCrcs.length).toBe(2);
    expect(centralCrcs.length).toBe(2);

    // Check that the CRC in local header matches the expected CRC
    expect(localCrcs[0]).toBe(expectedCrc1);
    expect(localCrcs[1]).toBe(expectedCrc2);

    // Check that the CRC in central header matches the expected CRC
    expect(centralCrcs[0]).toBe(expectedCrc1);
    expect(centralCrcs[1]).toBe(expectedCrc2);
  });
});