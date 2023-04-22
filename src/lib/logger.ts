import 'colors';

export default class Logger {
    constructor(private module?: string) {}

    public info(message: string, module?: string): void {
        this.module && (module = this.module);
        console.log(`[${this.getTime()}][${module?.toUpperCase()}][STACKER] |  ${message}`.magenta);
    }
    public success(message: string, module?: string): void {
        this.module && (module = this.module);
        console.log(`[${this.getTime()}][${module?.toUpperCase()}][STACKER] |  ${message}`.green);
    }
    public error(message: string, module?: string): void {
        this.module && (module = this.module);
        console.log(`[${this.getTime()}][${module?.toUpperCase()}][STACKER] |  ${message}`.red);
    }

    private getTime(): string {
        const date = new Date();
        return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
    }
}
