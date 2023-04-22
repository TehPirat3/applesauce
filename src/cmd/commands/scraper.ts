import { Command } from '../commands';
import { scrapeCodes } from '@Modules/bedBathBeyond/account/codeScraper';

export const scrape = (): Command => {
    return {
        name: 'scrape bbb',
        description: 'Scrapes codes from email',
        run: (args: string[]) => {
            !args[1] && console.log('Please provide module'.red);
            scrapeCodes();
        }
    };
};
