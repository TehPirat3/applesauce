import { TaskJson } from './interfaces';
import { logger } from '../../master';
import { updateTitle } from '@Lib/titleManager';
export default abstract class baseTask {
    protected _running = false;
    protected readonly _taskSteps: Array<() => Promise<void>> = [];

    protected abstract setTaskSteps(): void;

    constructor(protected _taskInput: TaskJson) {}

    private async runTaskSteps(): Promise<void> {
        running: for (const step of this._taskSteps) {
            while (this._running) {
                //@ts-ignore
                await this[step.name]();
                continue running;
            }
        }
    }

    public start(): void {
        if (this._running) return;
        this._running = true;
        try {
            this.setTaskSteps();
            this.runTaskSteps();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            this.error(error.message || error || 'Unknown error');
        }
    }
    public stop(): void {
        if (!this._running) return;
        this._running = false;
        updateTitle('failed');
    }
    protected info(message: string): void {
        logger.info(message, this._taskInput.site.identifier);
    }
    protected success(message: string): void {
        logger.success(message, this._taskInput.site.identifier);
    }
    protected error(message: string): void {
        logger.error(message, this._taskInput.site.identifier);
    }

    public get running(): boolean {
        return this._running;
    }
    public get site(): string {
        return this._taskInput.site.identifier;
    }
}
