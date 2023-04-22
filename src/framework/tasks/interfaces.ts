export type MixedTaskExtras = BedBathBeyondTaskExtras;

export type SiteType = 'bedBathBeyond';

export interface TaskJson<Extras = MixedTaskExtras> {
    site: {
        identifier: SiteType;
        mode: string;
    };
    siteSpecificExtras: Extras;
}

export interface BedBathBeyondTaskExtras {
    mode: 'generate' | 'redeem';
    useCatchall: boolean;
    email: string;
    catchall: string;
    password: string;
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
}
