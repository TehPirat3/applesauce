import baseTask from '@Framework/tasks/baseTask';
import { BedBathBeyondTaskExtras, TaskJson } from '@Framework/tasks/interfaces';
import { imapManager, settingsManager } from '@Master';
import { TlsClient } from '@Services/grpc';
import { deviceList } from './constants';
import fs from 'fs';
import qs from 'qs';
import { sleep } from '@Modules/utils/utils';
export default class StackerTask extends baseTask {
    private readonly _task = this._taskInput.siteSpecificExtras;
    private readonly _proxy = settingsManager.fetchProxy();
    private readonly _client = new TlsClient(deviceList[Math.floor(Math.random() * deviceList.length)], this._proxy);

    private shippingGroup = '';
    private _sessionID = '';
    private orderNumber = '';
    private codesToUse: string[] = [];

    private first = true;

    constructor(protected _taskInput: TaskJson<BedBathBeyondTaskExtras>) {
        super(_taskInput);
    }

    protected setTaskSteps(): void {
        this._taskSteps.push(this.initialize, this.stackerFlow);
    }
    private async initialize(): Promise<void> {
        await this._client.initialize();
    }
    private async stackerFlow(): Promise<void> {
        const codes = fs.readFileSync('./settings/codes.txt', 'utf-8').split(/\r?\n/);
        await this.getSession();
        await this.startLogin();
        await this.accountLogin();
        this.codesToUse = codes.splice(0, 8);
        while (this.codesToUse.length > 7) {
            await this.addToCart();
            await this.prepCart();
            await this.addShipping();
            await this.submitShipping();
            for (const code of this.codesToUse) {
                const [number, pin] = code.split(':');
                await this.applyGiftCard({ number, pin });
            }
            await this.repriceCart();
            await this.submitBilling();
            await this.reviewCheckout();
            await this.submitOrder();
            await this.getOrderNumber();
            await sleep(30000);
            await this.cancelOrder();
            this.codesToUse = [];
            this.codesToUse = codes.splice(0, 8);
            this._running = true;
            this.info('Sleeping before next order');
            await sleep(this._task.redeemer.delay);
            this.first = false;
        }
        this.info(`Stacking complete | ${this.codesToUse.length} does not exceed 8`);
    }
    private async getSession(): Promise<void> {
        if (!this._running) return;
        try {
            this.info('Getting session');
            const response = await this._client.get(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/authentication/session-confirmation',
                {
                    authority: 'www.bedbathandbeyond.com',
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
                    'x-bbb-site-id': 'BedBathUS'
                }
            );
            this._sessionID = JSON.parse(response.body).data.sessionConfirmationNumber;
            return;
        } catch (e) {
            this.error('Failed to get session');
            return this.stop();
        }
    }
    private async addToCart(): Promise<void> {
        if (!this._running) return;
        try {
            const itemID = this.first
                ? this._task.redeemer.itemID.split(':')[0]
                : this._task.redeemer.itemID.split(':')[1];
            const skuID = this.first
                ? this._task.redeemer.skuID.split(':')[0]
                : this._task.redeemer.skuID.split(':')[1];
            const body = new URLSearchParams({
                jsonResultString: `{"addItemResults":[{"bts":false,"favStoreState":"null","mie":"false","porchPayLoadJson":"","prodId":"${itemID}","qty":"${this._task.redeemer.quantity}","refNum":"","registryId":null,"skuId":"${skuID}","rbyrItem":false,"reserveNow":"undefined","sddItem":false,"sddZipCode":null,"storeId":null,"warrantySkuId":""}]}`
            }).toString();
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/cart/item',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    'x-bbb-site-id': 'BedBathUS',
                    'X-B3-TraceId': '',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '2',
                    'x-b3-spanid': '',
                    'sec-ch-ua-platform': '"Windows"',
                    Accept: '*/*',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer:
                        'https://www.bedbathandbeyond.com/store/product/neato-d8-intelligent-robot-vacuum-wi-fi-connected-with-lidar-navigation-in-indigo/5517926',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.info('Added to cart');
                return;
            } else {
                this.error('Failed to add to cart' + json.errorMessages[0].message);
                return this.stop();
            }
        } catch {
            this.error('Error to add to cart');
            return this.stop();
        }
    }
    private async prepCart(): Promise<void> {
        if (!this._running) return;
        try {
            const body = new URLSearchParams({
                groupedCartSingleShip: 'true'
            }).toString();
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/cart/checkout-cart',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '2',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/cart',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.info('Prepped cart');
                return;
            }
        } catch (e) {
            this.error('Error to prep cart');
            return this.stop();
        }
    }
    private async applyGiftCard(giftcard: { number: string; pin: string }): Promise<void> {
        if (!this._running) return;

        this.info('Applying giftcard');
        const body = new URLSearchParams({
            giftCardNumber: giftcard.number,
            giftCardPin: giftcard.pin,
            cardType: 'GC',
            opEdit: 'false'
        }).toString();
        try {
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/gift-card/apply',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '3',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.success('Successfully applied giftcard ' + giftcard.number);
                return;
            } else {
                this.error('Failed to apply giftcard ' + json.errorMessages[0].message);
                return;
            }
        } catch {
            this.error('Error applying giftcard');
            return this.stop();
        }
    }
    private async repriceCart(): Promise<void> {
        if (!this._running) return;
        try {
            const body = new URLSearchParams({
                pricingOp: 'ORDER_TOTAL',
                opEdit: 'false'
            }).toString();
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/order/reprice',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '5',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                return;
            } else {
                this.error('Failed to reprice cart');
                return this.stop();
            }
        } catch {
            this.error('Failed to reprice cart');
            return this.stop();
        }
    }
    private async addShipping(): Promise<void> {
        if (!this._running) return;
        try {
            const response = await this._client.get(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/shipping/address/all',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynsessconf: this._sessionID,
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '2',
                    accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'accept-language': 'en-US,en;q=0.9'
                }
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.shippingGroup = json.data.atgResponse[0].identifier;
                return;
            }
            this.error('Failed to add shipping');
            this.storeCards('failed');
            return this.stop();
        } catch {
            this.error('Error to add shipping');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async submitShipping(): Promise<void> {
        if (!this._running) return;
        try {
            const body = JSON.stringify({
                qasRecommendedAddress: false,
                editMode: false,
                addAddressFromShippingInfo: false,
                'address.firstName': this._task.redeemer.profile.firstName,
                'address.lastName': this._task.redeemer.profile.lastName,
                'address.companyName': '',
                'address.address1': this._task.redeemer.profile.address,
                'address.city': this._task.redeemer.profile.city,
                'address.state': this._task.redeemer.profile.state,
                'address.country': this._task.redeemer.profile.country,
                'address.postalCode': this._task.redeemer.profile.zip,
                redirectToReview: true,
                selectedShippingGroupName: this.shippingGroup,
                'billingAddressFormHandler.billingAddress.email': this._task.redeemer.profile.email,
                'billingAddressFormHandler.billingAddress.phoneNumber': this._task.redeemer.profile.phone,
                'billingAddressFormHandler.billingAddress.phoneOptInSelected': false,
                'billingAddressFormHandler.confirmedEmail': this._task.redeemer.profile.email,
                'billingAddressFormHandler.userSelectedOption': 'NEW',
                'billingAddressFormHandler.emailSignUp': true,
                orderIncludesGifts: false,
                cisiIndex: 0
            });
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/shipping/add-shipping-info',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynsessconf: this._sessionID,
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'content-type': 'application/json',
                    'atg-rest-depth': '5',
                    accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    origin: 'https://www.bedbathandbeyond.com',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-dest': 'empty',
                    referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'accept-language': 'en-US,en;q=0.9'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.success('Successfully submitted shipping');
                return;
            }
            this.error('Failed to submit shipping');
            return this.stop();
        } catch {
            this.error('Error to submit shipping');
            return this.stop();
        }
    }
    private async submitBilling(): Promise<void> {
        if (!this._running) return;
        try {
            const body = JSON.stringify({
                userSelectedOption: 'NEW',
                'billingAddress.firstName': this._task.redeemer.profile.firstName,
                'billingAddress.lastName': this._task.redeemer.profile.lastName,
                'billingAddress.address1': this._task.redeemer.profile.address,
                'billingAddress.city': this._task.redeemer.profile.city,
                'billingAddress.state': this._task.redeemer.profile.state,
                'billingAddress.country': this._task.redeemer.profile.country,
                'billingAddress.postalCode': this._task.redeemer.profile.zip,
                'billingAddress.email': this._task.redeemer.profile.email,
                confirmedEmail: this._task.redeemer.profile.email,
                'billingAddress.phoneNumber': this._task.redeemer.profile.phone,
                'billingAddress.mobileNumber': this._task.redeemer.profile.phone,
                isEditMode: false,
                'billingAddress.phoneOptInSelected': false,
                saveToAccount: true,
                fromPayment: true
            });
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/cart/billing-address?singlePageCheckoutEnabled=false',
                {
                    authority: 'www.bedbathandbeyond.com',
                    _dynsessconf: this._sessionID,
                    accept: 'application/json, text/plain, */*',
                    'accept-language': 'en-US,en;q=0.9',
                    'atg-rest-depth': '5',
                    'cache-control': 'no-cache',
                    'content-type': 'application/json',
                    ispreview: 'false',
                    origin: 'https://www.bedbathandbeyond.com',
                    pragma: 'no-cache',
                    referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    undefined: 'BedBathUS',
                    'user-agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.info('Successfully submitted billing');
                return;
            } else {
                this.error('Failed to submit billing ' + json.errorMessages[0].message);
                this.storeCards('failed');
                return this.stop();
            }
        } catch {
            this.storeCards('failed');
            this.error('Error submitting billing');
            return this.stop();
        }
    }
    private async reviewCheckout(): Promise<void> {
        if (!this._running) return;
        const body = '';
        try {
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/review-order?groupedCart=true&gcFromCartPage=false',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '5',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'text/plain'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.info('Successfully reviewed checkout');
                return;
            }
            this.error('Failed to review checkout');
            this.storeCards('failed');
            return this.stop();
        } catch {
            this.storeCards('failed');
            this.error('Error reviewing checkout');
            return this.stop();
        }
    }
    private async submitOrder(): Promise<void> {
        if (!this._running) return;

        this.info('Submitting order');
        try {
            const body = JSON.stringify({
                edd_analytics_payload: {},
                emailOptIn: true,
                paymentScheduleChecksum: ''
            });
            const response = await this._client.post(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/submitOrder',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    'atg-rest-depth': '3',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'Accept-Language': 'en-US,en;q=0.9'
                },
                body
            );
            const json = JSON.parse(response.body);
            if (json.serviceStatus === 'SUCCESS') {
                this.success('Order placed successfully!');
                this.storeCards('success');
                return;
            } else {
                this.error('Order failed to place ' + json.errorMessages[0].message);
                this.storeCards('failed');
                return this.stop();
            }
        } catch {
            this.error('Order error to place');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async getOrderNumber(): Promise<void> {
        if (!this._running) return;
        try {
            this.info('Getting order number');
            const response = await this._client.get(
                'https://www.bedbathandbeyond.com/apis/stateful/v1.0/checkout/order-confirmation?FEO_REST_IDENTIFIER=true&verReq=true&groupedCart=true&gcFromCartPage=false',
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json',
                    'atg-rest-depth': '3',
                    Accept: 'application/json, text/plain, */*',
                    undefined: 'BedBathUS',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/checkout',
                    'Accept-Language': 'en-US,en;q=0.9'
                }
            );
            const json = JSON.parse(response.body);
            this.orderNumber = json.data.atgResponse.lastOrder.onlineOrderNumber;
            this.info('Order number: ' + this.orderNumber);
        } catch {
            this.error('Error getting order number');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async cancelOrder(): Promise<void> {
        if (!this._running) return;

        this.info('Cancelling order...');
        try {
            const [email] = this._task.redeemer.login.split(':');
            const body = new URLSearchParams({
                emailId: email.replace('@', '%40'),
                orderNumber: this.orderNumber,
                retryCancellation: 'true'
            }).toString();
            const profileCookie = await this._client.getCookie('https://www.bedbathandbeyond.com', 'ATG_PROFILE_DATA');
            if (!profileCookie) {
                this.error('Failed to fetch account info when canceling order');
                this.storeCards('failed');
                return this.stop();
            }
            await this._client.post(
                `https://www.bedbathandbeyond.com/apis/stateful/v1.0/customers/${profileCookie}/orders/cancelOrder`,
                {
                    Host: 'www.bedbathandbeyond.com',
                    'sec-ch-ua': '"Not_A Brand";v="99", "Google Chrome";v="109", "Chromium";v="109"',
                    'x-bbb-site-id': 'BedBathUS',
                    ispreview: 'false',
                    'sec-ch-ua-mobile': '?0',
                    _dynSessConf: this._sessionID,
                    'User-Agent':
                        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'atg-rest-depth': '1',
                    Accept: 'application/json, text/plain, */*',
                    'sec-ch-ua-platform': '"Windows"',
                    Origin: 'https://www.bedbathandbeyond.com',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Dest': 'empty',
                    Referer: 'https://www.bedbathandbeyond.com/store/account/order_summary',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            );
            this.error('Order cancelled');
            return;
        } catch {
            this.info('Order failed to cancel');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async startLogin(): Promise<void> {
        if (!this._running) return;

        this.info('Starting login process');
        const [email, pass] = this._task.redeemer.login.split(':');
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
                    this.storeCards('failed');
                    return this.stop();
                default:
                    this.error('Failed to login');
                    this.storeCards('failed');
                    return this.stop();
            }
        } catch (e) {
            this.error('Failed to start login');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async accountLogin(): Promise<void> {
        if (!this._running) return;

        const [email, pass] = this._task.redeemer.login.split(':');
        const pin = await (async () => {
            try {
                await sleep(15000);
                //give it some time to send the email
                const code = await imapManager.getLoginPin(email);
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
            this.storeCards('failed');
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
            return this.stop();
        } catch {
            this.error('Error logging in');
            this.storeCards('failed');
            return this.stop();
        }
    }
    private async storeCards(type: 'failed' | 'success'): Promise<void> {
        const file = type === 'failed' ? './settings/failedCards.txt' : './settings/usedCards.txt';
        fs.writeFileSync(file, this.codesToUse.join('\n') + '\n', { flag: 'a' });
        return;
    }
}
