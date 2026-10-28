import { networkInterfaces } from "node:os";

export function listenHost(lan) {
  return lan ? "0.0.0.0" : "127.0.0.1";
}
export function lanUrls(port, interfaces = networkInterfaces()) {
  const addresses = Object.values(interfaces).flatMap(entries => entries || [])
    .filter(entry => entry.family === "IPv4" && !entry.internal && !entry.address.startsWith("169.254."))
    .map(entry => `http://${entry.address}:${port}`);
  return [...new Set(addresses)].sort();
}
