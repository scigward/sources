///////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Main Functions          //////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

async function searchResults(keyword) {
    try {

        const encodedKeyword = encodeURIComponent(keyword);
        const searchUrl = `https://animekai.to/browser?keyword=${encodedKeyword}`;
        const response = await fetchv2(searchUrl);
        const responseText = await response.text();

        const results = [];
        const baseUrl = "https://animekai.to";

        const listRegex = /<div class="aitem">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
        let match;

        while ((match = listRegex.exec(responseText)) !== null) {
            const block = match[1];

            const hrefRegex = /<a[^>]+href="([^"]+)"[^>]*class="poster"[^>]*>/;
            const hrefMatch = block.match(hrefRegex);
            let href = hrefMatch ? hrefMatch[1] : null;
            if (href && !href.startsWith("http")) {
                href = href.startsWith("/")
                    ? baseUrl + href
                    : baseUrl + href;
            }

            const imgRegex = /<img[^>]+data-src="([^"]+)"[^>]*>/;
            const imgMatch = block.match(imgRegex);
            const image = imgMatch ? imgMatch[1] : null;

            const titleRegex = /<a[^>]+class="title"[^>]+title="([^"]+)"[^>]*>/;
            const titleMatch = block.match(titleRegex);
            const title = cleanHtmlSymbols(titleMatch ? titleMatch[1] : null);

            if (href && image && title) {
                results.push({ href, image, title });
            }
        }

        return JSON.stringify(results);
    }
    catch (error) {
        console.log('SearchResults function error' + error);
        return JSON.stringify(
            [{ href: 'https://error.org', image: 'https://error.org', title: 'Error' }]
        );
    }
}

async function extractDetails(url) {
    try {

        const fetchUrl = `${url}`;
        const response = await fetchv2(fetchUrl);
        const responseText = await response.text();


        const details = [];

        const descriptionMatch = /<div class="desc text-expand">([\s\S]*?)<\/div>/;
        let description = descriptionMatch.exec(responseText);

        const aliasesMatch = /<small class="al-title text-expand">([\s\S]*?)<\/small>/;
        let aliases = aliasesMatch.exec(responseText);

        if (description && aliases) {
            details.push({
                description: description[1] ? cleanHtmlSymbols(description[1]) : "Not available",
                aliases: aliases[1] ? cleanHtmlSymbols(aliases[1]) : "Not available",
                airdate: "Not available"
            });
        }

        return JSON.stringify(details);
    }
    catch (error) {
        console.log('Details error:' + error);
        return JSON.stringify([{
            description: 'Error loading description',
            aliases: 'Aliases: Unknown',
            airdate: 'Aired: Unknown'
        }]);
    }
}


// === Episode Extractor (Regex + KaiCodex) ===
async function extractEpisodes(url) {
  const res = await fetchv2(url);
  const html = await res.text();

  const idMatch = html.match(/data-id=["'](\d+)["']/);
  if (!idMatch) return [];

  const animeId = idMatch[1];
  const token = await kaiEncrypt(animeId);
  const epRes = await fetchv2(`https://animekai.to/ajax/episodes/list?ani_id=${animeId}&_=${token}`);
  const epJson = await epRes.json();
  const htmlList = cleanJsonHtml(epJson.result);

  const episodes = [];
  const epRegex = /<a[^>]*num=["'](\d+)["'][^>]*token=["']([^"']+)["'][^>]*>(?:Episode\s*\d+)?(?:<span>([^<]*)<\/span>)?<\/a>/g;

  let match;
  while ((match = epRegex.exec(htmlList)) !== null) {
    const epNum = match[1];
    const token = match[2];
    const label = match[3]?.trim();
    const title = label ? `Episode ${epNum}: ${label}` : `Episode ${epNum}`;

    episodes.push({
      number: parseInt(epNum),
      token,
      title
    });
  }

  return episodes;
}

// === Hardsub Stream Extractor (Regex + KAICODEX) ===
async function extractStreamUrl(epToken) {
  const encryptedToken = await kaiEncrypt(epToken);
  const res = await fetchv2(`https://animekai.to/ajax/links/list?token=${epToken}&_=${encryptedToken}`);
  const resJson = await res.json();
  const html = cleanJsonHtml(resJson.result);

  const subSection = html.match(/<div[^>]*data-id=["']sub["'][^>]*>([\s\S]*?)<\/div>/);
  if (!subSection) return [];

  const block = subSection[1];
  const lidMatch = block.match(/<span[^>]*data-lid=["']([^"']+)["'][^>]*>Server\s*1<\/span>/);
  if (!lidMatch) return [];

  const lid = lidMatch[1];
  const megaUrl = await getMegaUrl(lid);
  const streams = await decryptMegaEmbed(megaUrl, "Server 1", "HARDSUB");

  return streams.map(s => s.url);
}


////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////       Helper Functions       ////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////

function cleanHtmlSymbols(string) {
    if (!string) return "";

    return string
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\r?\n|\r/g, " ")  // Replace any type of newline with a space
        .replace(/\s+/g, " ")       // Replace multiple spaces with a single space
        .trim();                    // Remove leading/trailing whitespace
}

function cleanJsonHtml(jsonHtml) {
    if (!jsonHtml) return "";

    return jsonHtml
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, '\\')
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r');
}

// Credits to @AnimeTV Project for the KAICODEX
// === Required: Load KaiCodex ===
async function loadKaiCodex() {
  try {
    const url = 'https://raw.githubusercontent.com/amarullz/kaicodex/refs/heads/main/generated/kai_codex.js';
    const response = await fetchv2(url);
    const scriptText = await response.text();
    const patched = scriptText + "\nthis.KAICODEX = KAICODEX;";
    eval(patched);
  } catch (error) {
    console.log("Load Kaicodex error:", error);
  }
}

// === KAICODEX encryption helper ===
async function kaiEncrypt(input) {
  if (typeof KAICODEX === 'undefined') await loadKaiCodex();
  return KAICODEX.enc(input);
}

// === KAICODEX decryption + mega embed parser ===
async function getMegaUrl(dataLid) {
  const encrypted = await kaiEncrypt(dataLid);
  const fetchUrl = `https://animekai.to/ajax/links/view?id=${dataLid}&_=${encrypted}`;
  const res = await fetchv2(fetchUrl);
  const json = await res.json();
  const decoded = KAICODEX.dec(json.result);
  const parsed = JSON.parse(decoded);
  return parsed.url;
}

async function decryptMegaEmbed(megaEmbedUrl, serverName = "", quality = "") {
  const mediaUrl = megaEmbedUrl.replace("/e/", "/media/");
  const res = await fetchv2(mediaUrl);
  const mediaJson = await res.json();

  let decoded = KAICODEX.decMega(mediaJson.result);
  let parsed = JSON.parse(decoded);

  const streams = [];
  if (parsed.sources && parsed.sources.length > 0) {
    for (const s of parsed.sources) {
      if (s.file && s.file.includes(".m3u8")) {
        streams.push({
          url: s.file,
          quality: s.label || quality,
          name: serverName
        });
      }
    }
  }

  return streams;
}

function btoa(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input);
    let output = '';

    for (let block = 0, charCode, i = 0, map = chars;
        str.charAt(i | 0) || (map = '=', i % 1);
        output += map.charAt(63 & (block >> (8 - (i % 1) * 8)))) {
        charCode = str.charCodeAt(i += 3 / 4);
        if (charCode > 0xFF) {
            throw new Error("btoa failed: The string contains characters outside of the Latin1 range.");
        }
        block = (block << 8) | charCode;
    }

    return output;
}

function atob(input) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = String(input).replace(/=+$/, '');
    let output = '';

    if (str.length % 4 == 1) {
        throw new Error("atob failed: The input is not correctly encoded.");
    }

    for (let bc = 0, bs, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4)
            ? output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))
            : 0) {
        buffer = chars.indexOf(buffer);
    }

    return output;
}


