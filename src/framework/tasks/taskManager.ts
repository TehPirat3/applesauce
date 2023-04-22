import BedBathBeyondTask from '@Modules/bedBathBeyond/account/accountManager';
import baseTask from './baseTask';
import { SiteType, TaskJson } from './interfaces';
import { v4 } from 'uuid';
import { settingsManager } from '@Master';
import { sleep } from '@Modules/utils/utils';
import fs from 'fs';
export default class TaskManager {
    private _moduleRunning = false;

    private readonly _tasks = new Map<string, baseTask>();

    public createTask(taskJSON: TaskJson): null {
        const createdTask = ((): baseTask | null => {
            //switch for other sites that will be added later
            switch (taskJSON.site.identifier) {
                case 'bedBathBeyond':
                    return new BedBathBeyondTask(taskJSON);
                default:
                    return null;
            }
        })();
        if (!createdTask) return null;
        this._tasks.set(v4(), createdTask);
        return null;
    }
    public async createAllTasks(): Promise<void> {
        const settings = settingsManager.readConfig();
        const file = (() => {
            //no file if use catchall
            if (settings.bedBathBeyond.useCatchall && settings.bedBathBeyond.mode != 'redeem') return null;
            switch (settings.bedBathBeyond.mode) {
                case 'generate':
                    return fs.readFileSync('./settings/emails.txt', 'utf8').split(/\r?\n/);
                case 'redeem':
                    return fs.readFileSync('./settings/accounts.txt', 'utf8').split(/\r?\n/);
            }
        })();
        const taskAmt = settings.bedBathBeyond.useCatchall ? settings.bedBathBeyond.taskAmount : file!.length;
        for (let i = 0; i < taskAmt; i++) {
            const email = file ? file[i] : '';
            this.createTask({
                site: {
                    identifier: 'bedBathBeyond',
                    mode: 'account'
                },
                siteSpecificExtras: {
                    ...settings.bedBathBeyond,
                    catchall: settings.settings.catchall,
                    email: email
                }
            });
        }
    }
    public async startAllTasks(module: SiteType): Promise<void> {
        if (this._moduleRunning) return console.log('Module already running...'.red);
        const settings = settingsManager.readConfig();
        this._moduleRunning = true;
        //stagger start each task by 1 second
        for (const task of this._tasks.values()) {
            if (task.site === module) {
                task.site === 'bedBathBeyond' && (await sleep(settings.bedBathBeyond.taskDelay));
                task.start();
            }
        }
    }
    public stopAllTasks(module: SiteType): void {
        this._moduleRunning = false;
        this._tasks.forEach(task => {
            task.running && task.site === module && task.stop();
        });
    }
    public get tasks(): Map<string, baseTask> {
        return this._tasks;
    }
}
