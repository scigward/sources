function searchResults(html) {
    const results = [];

    const titleRegex = /<h2[^>]*>(.*?)<\/h2>/;
    const hrefRegex = /<a\s+href="([^"]+)"\s*[^>]*>/;
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/;

    const itemRegex = /<div class="my-2 w-64[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g;
    const items = html.match(itemRegex) || [];

    items.forEach((itemHtml) => {
        const titleMatch = itemHtml.match(titleRegex);
        const title = titleMatch ? titleMatch[1].trim() : '';

        const hrefMatch = itemHtml.match(hrefRegex);
        const href = hrefMatch ? hrefMatch[1].trim() : '';

        const imgMatch = itemHtml.match(imgRegex);
        const imageUrl = imgMatch ? imgMatch[1].trim() : '';

        if (title && href) {
            results.push({
                title: title,
                image: imageUrl,
                href: href
            });
        }
    });
    return results;
}

function extractDetails(html) {
    const details = [];

    const descriptionMatch = html.match(/<p class="sm:text-\[1\.05rem\] leading-loose text-justify">([\s\S]*?)<\/p>/);
    let description = descriptionMatch ? descriptionMatch[1].trim() : '';

    const airdateMatch = html.match(/<td[^>]*title="([^"]+)">[^<]+<\/td>/);
    let airdate = airdateMatch ? airdateMatch[1].trim() : '';

    if (description && airdate) {
        details.push({
            description: description,
            aliases: 'N/A',
            airdate: airdate
        });
    }
    console.log(details);
    return details;
}

function extractEpisodes(html) {
    const episodes = [];
    const htmlRegex = /<a\s+[^>]*href="([^"]*?\/episode\/[^"]*?)"[^>]*>[\s\S]*?الحلقة\s+(\d+)[\s\S]*?<\/a>/gi;
    const plainTextRegex = /الحلقة\s+(\d+)/g;

    let matches;

    if ((matches = html.match(htmlRegex))) {
        matches.forEach(link => {
            const hrefMatch = link.match(/href="([^"]+)"/);
            const numberMatch = link.match(/الحلقة\s+(\d+)/);
            if (hrefMatch && numberMatch) {
                const href = hrefMatch[1];
                const number = numberMatch[1];
                episodes.push({
                    href: href,
                    number: number
                });
            }
        });
    } else if ((matches = html.match(plainTextRegex))) {
        matches.forEach(match => {
            const numberMatch = match.match(/\d+/);
            if (numberMatch) {
                episodes.push({
                    href: null, 
                    number: numberMatch[0]
                });
            }
        });
    }

    console.log(episodes);
    return episodes;
}

// Updated function to support quality selection (1080p, 720p, 480p)
async function extractStreamUrls(html) {
    try {
        const sourceMatch = html.match(/data-source="([^"]+)"/);
        const embedUrl = sourceMatch?.[1]?.replace(/&amp;/g, '&');
        if (!embedUrl) return [];

        const response = await fetch(embedUrl);
        const data = await response.text();

        const qualities = ['1080p', '720p', '480p']; // Available qualities
        const streams = [];

        for (const quality of qualities) {
            const regex = new RegExp(`src:\\s*'(https:\\/\\/[^']*${quality}\\.mp4[^']*)'`);
            const match = data.match(regex);
            if (match?.[1]) {
                streams.push({
                    title: quality,
                    url: match[1],
                    type: 'mp4',
                    behaviorHints: {
                        notWebReady: false
                    }
                });
            }
        }

        return streams;
    } catch (error) {
        console.error('Error extracting stream URLs:', error);
        return [];
    }
}
