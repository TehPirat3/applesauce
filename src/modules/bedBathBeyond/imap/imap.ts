import { settingsManager } from '@Master';
import imap from 'imap';
export default class ImapManager {
    private _client: imap | null = null;
    private readonly _settings = settingsManager.readConfig();
    public async createConnection(): Promise<void> {
        try {
            const { user, password, host } = this._settings.settings.imap;
            this._client = new imap({
                user: user,
                password: password,
                host: host,
                port: 993,
                tls: true,
                tlsOptions: { rejectUnauthorized: false }
            });
            this._client.connect();
            this._client.once('ready', () => {
                console.log('Imap connection created'.green);
            });
            this._client.on('error', (err: any) => {
                console.log(err.message);
            });
        } catch {
            console.log('Failed to create imap connection'.red);
        }
    }
    public getLoginPin(email: string): Promise<string> {
        return new Promise(resolve => {
            try {
                this._client?.openBox('INBOX', true, e => {
                    if (e) console.log(e.message);
                    this._client?.search(
                        ['UNSEEN', ['TO', email], ['HEADER', 'subject', 'Your Verification PIN']],
                        (err, results) => {
                            try {
                                if (err) console.log(err.message);
                                const f = this._client?.fetch(results, { bodies: '' });
                                const allCodes: string[] = [];
                                f?.on('message', msg => {
                                    msg.on('body', stream => {
                                        let buffer = '';
                                        stream.on('data', chunk => {
                                            buffer += chunk.toString('utf8');
                                        });
                                        stream.once('end', async () => {
                                            const pin = buffer.match(/(?<=your access pin ).*?(?= )/g);
                                            if (pin) {
                                                allCodes.push(pin[0]);
                                            }
                                        });
                                    });
                                });
                                f?.once('end', () => {
                                    //get the latest code
                                    resolve(allCodes[allCodes.length - 1]);
                                });
                            } catch (error: any) {
                                console.log(error.message);
                                resolve('');
                            }
                        }
                    );
                });
            } catch {
                console.log('Failed to get login pin'.red);
                return '';
            }
        });
    }
    public scrapeAllCodes(): Promise<string[]> {
        return new Promise(resolve => {
            try {
                this._client?.openBox('INBOX', true, e => {
                    if (e) console.log(e.message);
                    //get all emails from the first page
                    this._client?.search(['UNSEEN', ['HEADER', 'subject', 'Account Fund Details']], (err, results) => {
                        try {
                            if (err) console.log(err.message);
                            const f = this._client?.fetch(results, { bodies: '' });
                            const codes: string[] = [];
                            f?.on('message', msg => {
                                msg.on('body', stream => {
                                    let buffer = '';
                                    stream.on('data', chunk => {
                                        buffer += chunk.toString('utf8');
                                    });
                                    stream.once('end', async () => {
                                        const code = buffer.match(/\d{16}\s+PIN:\s+\d{8}/g);
                                        if (code) {
                                            const formatted = code[0].replace(' PIN: ', ':');
                                            const toEmail = buffer.match(/(?<=To: ).*?(?=\r\n)/g);
                                            codes.push(formatted);
                                        }
                                    });
                                });
                            });
                            f?.once('end', () => {
                                resolve(codes);
                            });
                        } catch (error: any) {
                            console.log(error.message);
                            resolve([]);
                        }
                    });
                });
            } catch {
                console.log('Failed to scrape codes'.red);
                return [];
            }
        });
    }
}
