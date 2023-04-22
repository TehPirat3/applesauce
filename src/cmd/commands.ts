import { scrape } from './commands/scraper';
import { stack } from './commands/stacker';
import { start } from './commands/start';

export interface Command {
    name: string;
    description: string;
    run: (args: string[]) => Promise<void> | void;
}

export const commands = new Map<string, Command>();

export const registerCommands = (): void => {
    commands.set('start', start());
    commands.set('scrape', scrape());
    commands.set('exit', {
        name: 'exit',
        description: 'Exits the program',
        run: async () => {
            process.exit();
        }
    });
    commands.set('stack', stack());
};
