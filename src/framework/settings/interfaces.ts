export interface Settings {
    settings: {
        key: string;
        catchall: string;
        webhook: string;
        imap: {
            user: string;
            password: string;
            host: string;
        };
    };
    bedBathBeyond: {
        mode: 'generate' | 'redeem';
        useCatchall: boolean;
        taskAmount: number;
        password: string;
        taskDelay: number;
        redeemer: {
            login: string;
            itemID: string;
            skuID: string;
            quantity: number;
            delay: number;
            profile: {
                firstName: string;
                lastName: string;
                address: string;
                city: string;
                state: string;
                country: string;
                zip: string;
                phone: string;
                email: string;
            };
        };
    };
}

interface CookieContainer {
    cookies: string;
    proxy: string;
}

export type CookiesJSON = Record<string, CookieContainer>;
