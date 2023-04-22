/* eslint-disable @typescript-eslint/no-explicit-any */
import { TlsClient } from '../../../services/grpc';
import qs from 'querystring';
import casual from 'casual';
import { imapManager, settingsManager } from '../../../master';
import baseTask from '../../../framework/tasks/baseTask';
import { BedBathBeyondTaskExtras, TaskJson } from '../../../framework/tasks/interfaces';
import fs from 'fs';
import { siteConfig, deviceList } from './constants';
import { updateTitle } from '@Lib/titleManager';
export default class BedBathBeyondTask extends baseTask {
    private readonly _task = this._taskInput.siteSpecificExtras;
    private readonly _proxy = settingsManager.fetchProxy();
    private readonly _client = new TlsClient(deviceList[Math.floor(Math.random() * deviceList.length)], this._proxy);

    private _sessionID = '';
    private readonly _siteConfig = siteConfig[Math.floor(Math.random() * siteConfig.length)];

    private readonly _profile = this.generateProfileData();

    constructor(protected _taskInput: TaskJson<BedBathBeyondTaskExtras>) {
        super(_taskInput);
    }

    protected setTaskSteps(): void {
        this._taskSteps.push(this.initializeClient, this.getSession);
        switch (this._task.mode) {
            case 'generate':
                this._taskSteps.push(this.generateAkamai, this.submitSignup, this.storeLoginCookies);
                break;
            case 'redeem':
                this._taskSteps.push(
                    this.generateAkamai,
                    this.startLogin,
                    this.accountLogin,
                    this.redeemCode,
                    this.storeRedeemedAccounts
                );
                break;
        }
    }
    private async initializeClient(): Promise<void> {
        await this._client.initialize();
    }
    private async getSession(): Promise<void> {
        try {
            this.info('Getting session');
            const response = await this._client.get(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/authentication/session-confirmation',
                {
                    authority: 'www.bedbathandbeyond.com',
                    _dynsessconf: this._sessionID,
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9',
                    'atg-rest-depth': '2',
                    'content-type': 'application/x-www-form-urlencoded',
                    ispreview: 'false',
                    'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'x-bbb-site-id': this._siteConfig.siteId
                }
            );
            this._sessionID = JSON.parse(response.body).data.sessionConfirmationNumber;
            return;
        } catch (error: any) {
            this.error('Failed to get session');
            this.storeFailedAccounts();
            return this.stop();
        }
    }
    private async submitSignup(): Promise<void> {
        const data = new URLSearchParams({
            'value.email': this._profile.email.replace('@', '%40'),
            'value.firstName': this._profile.firstName,
            'value.lastName': this._profile.lastName,
            emailOptIn: 'false',
            'value.mobileNumber': this._profile.phone,
            birthMonth: '1',
            birthDay: Math.floor(Math.random() * 28).toString(),
            'value.loyaltyTnCAcceptance': 'true',
            'value.password': this._profile.password,
            emailOptInSharedSite1: 'false',
            emailOptInSharedSite2: 'false',
            emailOptIn_BabyCA: 'false',
            verReq: 'true',
            'deviceValue.deviceAutoLogin': 'true',
            'deviceValue.browserType': 'chrome',
            'deviceValue.browserVersion': '108',
            'deviceValue.deviceId': '',
            'deviceValue.os': 'Windows',
            'deviceValue.osVersion': '10',
            'deviceValue.timeZone': 'America/New_York',
            'deviceValue.plugins':
                'PDF Viewer,Chrome PDF Viewer,Chromium PDF Viewer,Microsoft Edge PDF Viewer,WebKit built-in PDF',
            'deviceValue.contentLanguage': 'en-US',
            assoSite: 'HarmonUS'
        }).toString();

        try {
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/customers',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not?A_Brand";v="8", "Chromium";v="108", "Google Chrome";v="108"',
                    'x-bbb-site-id': 'HarmonUS',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynsessconf: this._sessionID,
                    'User-Agent': 'BedBathAndBeyond/9 CFNetwork/1390 Darwin/22.0.0',
                    'content-type': 'application/x-www-form-urlencoded',
                    'atg-rest-depth': '2',
                    accept: 'application/json, text/plain, */*',
                    'sec-ch-ua-platform': '"Windows"',
                    origin: 'https://www.bedbathandbeyond.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.bedbathandbeyond.com/store/account/Login',
                    'accept-language': 'en-US,en;q=0.9',
                    Traffic_OS: 'IOS',
                    origin_of_traffic: 'MobileApp',
                    'x-nds-pmd': 'null'
                },
                data
            );
            try {
                if (response.status === 403) {
                    this.error('Akamaai block, retrying');
                    this.storeFailedAccounts();
                    return this.stop();
                }
                if (JSON.parse(response.body).serviceStatus === 'SUCCESS') {
                    this.success(`Created account for ${this._profile.email.replace('%40', '@')}`);
                    updateTitle('success');
                    return;
                } else {
                    this.storeFailedAccounts();
                    this.error('Failed to create account ' + this._task.email);
                    return this.stop();
                }
            } catch {
                this.storeFailedAccounts();
                this.error('Invalid response, creation failed');
                return this.stop();
            }
        } catch (error: any) {
            this.storeFailedAccounts();
            this.error('Error creating account ' + error.status);
            return this.stop();
        }
    }

    // --------------------- MISC HANDLING ---------------------
    private generateProfileData(): {
        phone: string;
        firstName: string;
        lastName: string;
        password: string;
        email: string;
    } {
        const numbers = '0123456789';
        let phone = '';
        for (let i = 0; i < 10; i++) {
            phone += numbers.charAt(Math.floor(Math.random() * numbers.length));
        }
        const fname = casual.first_name;
        const lname = casual.last_name;
        return {
            phone: phone,
            firstName: fname,
            lastName: lname,
            password: this._task.password,
            email: this._task.useCatchall ? `${fname}${lname}%40${this._task.catchall}` : this._task.email.split(':')[0]
        };
    }
    private async generateAkamai(): Promise<void> {
        //
    }
    private async storeLoginCookies(): Promise<void> {
        //store cooies in an object with the account email as the key and the cookies as the value
        const formattedEmail = this._profile.email.replace('%40', '@');
        //settingsManager.addCookie(formattedEmail, this._loginCookies, this._proxy);
        fs.writeFileSync('./settings/accounts.txt', `${formattedEmail}:${this._profile.password}\n`, {
            flag: 'a'
        });
        const data = fs.readFileSync('./settings/emails.txt', 'utf8').split('\n');
        const index = data.indexOf(this._profile.email);
        index > -1 && data.splice(index, 1);
        fs.writeFileSync('./settings/emails.txt', data.join('\n'), { flag: 'w' });
    }
    // --------------------- GC REDEEMER STUFF HERE ---------------------
    private async storeRedeemedAccounts(): Promise<void> {
        const [email, pass] = this._task.email.split(':');
        fs.writeFileSync('./settings/redeemed.txt', `${email}:${pass}\n`, {
            flag: 'a'
        });
        //remove from accounts.txt
        const data = fs.readFileSync('./settings/accounts.txt', 'utf8').split('\n');
        const index = data.indexOf(this._task.email);
        index > -1 && data.splice(index, 1);
        fs.writeFileSync('./settings/accounts.txt', data.join('\n'), { flag: 'w' });
    }
    private async storeFailedAccounts(): Promise<void> {
        fs.writeFileSync('./settings/failed.txt', `${this._profile.email}\n`, {
            flag: 'a'
        });
    }
    private async startLogin(): Promise<void> {
        this.info('Starting login process');
        const [email, pass] = this._task.email.split(':');
        const data = qs.stringify({
            'deviceValue.IMEI': '',
            'value.password': encodeURIComponent(pass),
            'deviceValue.timeZone': 'America/Detroit (fixed (equal to current))',
            'deviceValue.os': 'ios',
            'deviceValue.osVersion': '16.0.2',
            'deviceValue.challengeAnswer2': '',
            'value.login': email.replace('%40', '@'),
            'deviceValue.rememberme': 'false',
            'deviceValue.deviceId': '',
            verReq: 'true',
            'deviceValue.challengeAnswer1': ''
        });
        try {
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/authentication/loginSecure',
                {
                    Host: 'www.bedbathandbeyond.com',
                    Referer: '{}',
                    enableLoyalty: 'true',
                    'User-Agent': 'BedBathAndBeyond/4 CFNetwork/1390 Darwin/22.0.0',
                    'x-bbb-channel': 'MobileApp',
                    'atg-rest-depth': '5',
                    _dynSessConf: this._sessionID,
                    Traffic_OS: 'IOS',
                    env: '{}',
                    Accept: 'application/json',
                    'x-bbb-site-id': 'BedBathUS',
                    origin_of_traffic: 'MobileApp',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-nds-pmd': 'null'
                },
                data
            );
            switch (response.status) {
                case 401:
                    this.info('Polling for login code');
                    break;
                case 403:
                    this.error('Akamai block, stopping task');
                    return this.stop();
                default:
                    this.error('Failed to login');
                    this.storeFailedAccounts();
            }
        } catch (e) {
            this.error('Failed to start login');
            this.storeFailedAccounts();
            return this.stop();
        }
    }
    private async accountLogin(): Promise<void> {
        const [email, pass] = this._task.email.split(':');
        const pin = await (async () => {
            try {
                await this.sleep(15000);
                //give it some time to send the email
                const code = await imapManager.getLoginPin(this._profile.email);
                if (!code) {
                    this.error('Failed to get code from email');
                    return null;
                }
                return code;
            } catch {
                this.error('Failed to poll email for code');
                return null;
            }
        })();
        if (!pin) {
            this.storeFailedAccounts();
            return this.stop();
        }
        try {
            const data = new URLSearchParams({
                'value.login': email.replace('@', '%40'),
                'value.password': encodeURIComponent(pass),
                verReq: 'true',
                'deviceValue.deviceAutoLogin': 'true',
                'deviceValue.acesscode': pin,
                'deviceValue.rememberme': 'true',
                'deviceValue.accessCodeType': 'email_pin',
                'deviceValue.browserType': 'chrome',
                'deviceValue.browserVersion': '108',
                'deviceValue.deviceId': '',
                'deviceValue.os': 'Windows',
                'deviceValue.osVersion': '10',
                'deviceValue.timeZone': 'America/New_York',
                'deviceValue.plugins':
                    'PDF Viewer,Chrome PDF Viewer,Chromium PDF Viewer,Microsoft Edge PDF Viewer,WebKit built-in PDF',
                'deviceValue.contentLanguage': 'en-US',
                'value.loyaltyTnCAcceptance': 'true',
                'value.loyaltyVerifyScreen': 'false'
            }).toString();
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/authentication/loginSecure',
                {
                    Host: 'www.bedbathandbeyond.com',
                    Referer: '{}',
                    enableLoyalty: 'true',
                    'User-Agent': 'BedBathAndBeyond/4 CFNetwork/1390 Darwin/22.0.0',
                    'x-bbb-channel': 'MobileApp',
                    'atg-rest-depth': '5',
                    _dynSessConf: this._sessionID,
                    Traffic_OS: 'IOS',
                    env: '{}',
                    Accept: 'application/json',
                    'x-bbb-site-id': 'BedBathUS',
                    origin_of_traffic: 'MobileApp',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'x-nds-pmd': 'null'
                },
                data
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.success('Successfully logged in');
                return;
            }
            this.error('Failed to login ' + json.errorMessages[0].message);
            this.storeFailedAccounts();
            return this.stop();
        } catch (error) {
            this.error('Error logging in');
            this.storeFailedAccounts();
            return this.stop();
        }
    }
    private async redeemCode(): Promise<void> {
        try {
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/account/storedvalue/send-barcodes-detail',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'x-bbb-site-id': 'BedBathUS',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                    'content-type': 'application/x-www-form-urlencoded',
                    'atg-rest-depth': '1',
                    accept: 'application/json, text/plain, */*',
                    'sec-ch-ua-platform': '"Windows"',
                    origin: 'https://www.bedbathandbeyond.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.bedbathandbeyond.com/store/account/my-wallet',
                    'accept-language': 'en-US,en;q=0.9',
                    dnt: '1'
                },
                'arg1=storedValue'
            );
            const json = JSON.parse(response.body);
            if (json.data.emailSent === true) {
                this.success('Successfully redeemed code');
                updateTitle('success');
            } else {
                this.error('Failed to redeem code ' + json.errorMessages[0].message);
                this.storeFailedAccounts();
                return this.stop();
            }
        } catch (error) {
            this.storeFailedAccounts();
            this.error('Error redeeming code');
            return this.stop();
        }
    }
    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
