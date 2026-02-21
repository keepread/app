import { extractMetadata } from "./metadata.js";

async function main() {
  const url = process.argv[2] ?? "https://www.mihaileric.com/The-Emperor-Has-No-Clothes/";
  const html = await fetch(url).then(r => r.text());
  console.log(JSON.stringify(extractMetadata(html, url), null, 2));
}

main();
