import { stdout, stdin } from 'process';
import { commands, registerCommands } from './commands';
import { eraseLines } from './utils';

export default class CommandHandler {
    public run(): void {
        registerCommands();
        this.runCommand();
    }

    private async runCommand(): Promise<void> {
        const command = await this.listener();
        const clean = command.toString().trim().split(' ');
        const cmd = commands.get(clean[0]);
        if (cmd) {
            console.clear();
            cmd.run(clean);
        } else {
            console.log('\nInvalid command'.red);
        }
        this.runCommand();
    }
    private async listener(): Promise<string> {
        //broken impl of a cool listener
        return new Promise(resolve => {
            const { isRaw } = stdin;

            this.cleanPrint('[BBB]: '.magenta);
            stdin.setRawMode(true);
            stdin.resume();

            const restore = () => {
                stdout.write('');
                stdin.setRawMode(isRaw);
                stdin.pause();
                stdin.removeListener('data', onData);
            };

            let val = '';
            let caretOffset = 0;

            const onData = (buffer: Buffer) => {
                stdout.moveCursor(0, process.stdout.rows - 1);
                const data = buffer.toString();
                if (data === '\u001B[D') {
                    if (val.length > Math.abs(caretOffset)) {
                        caretOffset--;
                    }
                } else if (data === '\u001B[C') {
                    if (caretOffset < 0) {
                        caretOffset++;
                    }
                } else if (data === '\u0008' || data === '\u007F') {
                    // Delete key needs splicing according to caret position
                    val = val.slice(0, val.length + caretOffset - 1) + val.slice(val.length + caretOffset);
                } else {
                    if (data === '\r') {
                        restore();
                        return resolve(val);
                    }
                    val = val.slice(0, val.length + caretOffset) + data + val.slice(val.length + caretOffset);
                }
                const color = commands.has(val.split(' ')[0]) ? 'green' : 'red';
                this.cleanPrint(eraseLines(1) + '[BBB]: '.magenta + val[color]);
            };
            stdin.on('data', onData);
        });
    }
    private cleanPrint(data: string): void {
        stdout.moveCursor(0, process.stdout.rows - 1);
        stdout.write(data);
        stdout.cursorTo(0, 0);
    }
}
