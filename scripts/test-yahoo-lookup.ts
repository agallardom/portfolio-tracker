import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
    const isins = ['US2546871060', 'IE00BFMXXD54', 'NL0011585146'];
    for (const isin of isins) {
        try {
            const result = await yahooFinance.search(isin);
            console.log(`ISIN: ${isin}`);
            if (result.quotes && result.quotes.length > 0) {
                console.log(`Found Ticker: ${result.quotes[0].symbol}`);
                console.log(`Name: ${(result.quotes[0] as any).shortname || (result.quotes[0] as any).longname}`);
            } else {
                console.log('No results found.');
            }
            console.log('---');
        } catch (e) {
            console.error(`Error searching ${isin}:`, e);
        }
    }
}

test();
