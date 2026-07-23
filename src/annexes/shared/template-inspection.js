import { inflateRawSync } from 'node:zlib';

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('Nie znaleziono katalogu centralnego ZIP.');
}

/** Reads one entry from a DOCX/ZIP without adding a runtime dependency. */
export function readZipEntry(buffer, wantedName) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entries = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);

  for (let index = 0; index < entries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Nieprawidłowy wpis ZIP.');
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (name === wantedName) {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
      if (compression === 0) return compressed;
      if (compression === 8) return inflateRawSync(compressed);
      throw new Error(`Nieobsługiwana metoda kompresji ZIP: ${compression}.`);
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error(`Brak wpisu ${wantedName} w archiwum.`);
}

export function extractDocxPlaceholders(buffer) {
  const xml = readZipEntry(buffer, 'word/document.xml').toString('utf8');
  const text = xml.replace(/<[^>]+>/g, '');
  return [...new Set(text.match(/\{\{[^}]+\}\}/g) ?? [])]
    .map((placeholder) => placeholder.slice(2, -2))
    .sort();
}
