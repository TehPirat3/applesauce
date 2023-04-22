import { Command } from '../commands';
import { SiteType } from '@Framework/tasks/interfaces';
import { settingsManager, taskManager } from '@Master';
import StackerTask from '@Modules/bedBathBeyond/account/stacker';

export const stack = (): Command => {
    return {
        name: 'stack',
        description: 'starts stacker',
        run: () => {
            //create here, since its only 1 task
            const settings = settingsManager.readConfig();
            const task = new StackerTask({
                site: {
                    identifier: 'bedBathBeyond',
                    mode: 'account'
                },
                siteSpecificExtras: {
                    ...settings.bedBathBeyond,
                    ...settings.settings,
                    email: ''
                }
            });
            task.start();
        }
    };
};
