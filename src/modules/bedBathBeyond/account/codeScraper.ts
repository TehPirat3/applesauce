import { imapManager } from '@Master';
import fs from 'fs';

export const scrapeCodes = async (): Promise<void> => {
    try {
        const codes = await imapManager.scrapeAllCodes();
        fs.writeFileSync('./settings/codes.txt', codes.join('\n'), 'utf8');
        console.log('Scraped codes from inbox'.green);
    } catch (error) {
        console.log('Failed to scrape codes from inbox'.red);
    }
};
