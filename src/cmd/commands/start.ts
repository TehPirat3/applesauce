import { Command } from '../commands';
import { SiteType } from '@Framework/tasks/interfaces';
import { taskManager } from '@Master';

export const start = (): Command => {
    return {
        name: 'start bbb',
        description: 'Starts tasks',
        run: (args: string[]) => {
            !args[1] && console.log('Please provide module'.red);
            const site = ((): SiteType | null => {
                switch (args[1]) {
                    case 'bbb':
                        return 'bedBathBeyond';
                    default:
                        return null;
                }
            })();
            if (!site) return console.log('Invalid module'.red);
            taskManager.startAllTasks(site);
        }
    };
};
