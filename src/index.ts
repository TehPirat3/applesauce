import 'module-alias/register';
import { sleep } from '@Modules/utils/utils';
import { auth, imapManager, taskManager } from './master';
import { cli } from './master';
import { updateTitle } from '@Lib/titleManager';
const main = async () => {
    const response = await auth.run();
    if (response != 'success') {
        console.log(response.red);
        await sleep(1000);
        return process.exit(1);
    } else {
        postAuth();
    }
    updateTitle('success');
};
const postAuth = () => {
    cli.run();
    imapManager.createConnection();
    taskManager.createAllTasks();
};
main();
