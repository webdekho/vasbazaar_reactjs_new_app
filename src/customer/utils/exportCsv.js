// Build + download/share a CSV. Works in the browser (anchor download) and on
// native (Capacitor Filesystem + Share). UTF-8 with BOM so Excel reads
// Devanagari names correctly.
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

const escapeCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildCsv = (headers, rows) => {
  const lines = [headers.map(escapeCell).join(",")];
  rows.forEach((r) => lines.push(r.map(escapeCell).join(",")));
  return "﻿" + lines.join("\r\n");
};

export const downloadCsv = async (filename, csv) => {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: filename, url: res.uri, dialogTitle: "Export CSV" });
    return;
  }
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
