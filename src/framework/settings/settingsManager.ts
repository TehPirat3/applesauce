import { CookiesJSON, Settings } from './interfaces';
import fs from 'fs';
import { proxyParser } from '@Modules/utils/utils';

export default class SettingsManager {
    public readConfig(): Settings {
        const settings = JSON.parse(fs.readFileSync('./settings/config.json', 'utf8'));
        return settings as Settings;
    }

    public addCookie(email: string, cookie: string, proxy: string): void {
        const cookies = this.getCookies();
        cookies[email] = { cookies: cookie, proxy: proxy };
        fs.writeFileSync('./settings/cookies.json', JSON.stringify(cookies, null, 4));
    }

    public getCookie(email: string): string | null {
        const cookies = this.getCookies();
        if (cookies[email]) return cookies[email].cookies;
        else return null;
    }

    private getCookies(): CookiesJSON {
        const cookies = JSON.parse(fs.readFileSync('./settings/cookies.json', 'utf8'));
        return cookies as CookiesJSON;
    }
    public fetchProxy(): string {
        const proxies = fs.readFileSync('./settings/proxies.txt', 'utf8').split(/\r?\n/);
        if (proxies.includes('localhost')) {
            return '';
        }
        return proxyParser(proxies[Math.floor(Math.random() * proxies.length)]);
    }
}
