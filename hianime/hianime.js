async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetch(`https://aniwatch140.vercel.app/anime/search?q=${encodedKeyword}`);
        const data = JSON.parse(responseText);
        
        const transformedResults = data.animes.map(anime => ({
            title: anime.name,
            image: anime.poster,
            href: `https://hianime.to/watch/${anime.id}`
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(url) {
try {
    const match = url.match(/https:\/\/hianime\.to\/watch\/(.+)$/);
    const encodedID = match[1];
    const response = await fetch(`https://aniwatch140.vercel.app/anime/info?id=${encodedID}`);
    const responseText = response.toString();
    
    let data;
    data = JSON.parse(responseText);
    const animeInfo = data.anime.info;
    
    const transformedResults = [{
        description: animeInfo.description || 'No description available',
        aliases: `Duration: ${animeInfo.stats?.duration || 'Unknown'}`,
        airdate: `Rating: ${animeInfo.stats?.rating || 'Unknown'}`
    }];

    return JSON.stringify(transformedResults);
    
} catch (error) {
    console.log('Details error:', error);
    return JSON.stringify([{
        description: 'Error loading description',
        aliases: 'Duration: Unknown',
        airdate: 'Rating: Unknown'
    }]);
}
}

async function extractEpisodes(url) {
    try {

        const testData = [
            { number: '1', href: 'https://hianime.to/watch/one-piece-episode-1' },
            { number: '2', href: 'https://hianime.to/watch/one-piece-episode-2' },
            { number: '3', href: 'https://hianime.to/watch/one-piece-episode-3' },
            { number: '4', href: 'https://hianime.to/watch/one-piece-episode-4' },
            { number: '5', href: 'https://hianime.to/watch/one-piece-episode-5' },
            { number: '6', href: 'https://hianime.to/watch/one-piece-episode-6' },
            { number: '7', href: 'https://hianime.to/watch/one-piece-episode-7' },
            { number: '8', href: 'https://hianime.to/watch/one-piece-episode-8' },
            { number: '9', href: 'https://hianime.to/watch/one-piece-episode-9' },
        ];

        return JSON.stringify(testData);

    } catch (error) {
        log('Fetch error:', error);
        return JSON.stringify([{ number: '0', href: '' }]);
    }
}
