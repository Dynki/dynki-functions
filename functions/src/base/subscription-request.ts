import { UserRecord } from "firebase-functions/lib/providers/auth";
import { Request } from "express";

export interface SubscriptionRequest extends Request {
    body: SubscriptionRequestBody;
}

interface SubscriptionRequestBody {
    log: any;
    status: any;

    displayName: string;
    email: string;
    name: string;
    group_name: string;
    memberOf: Array<string>;
    dynki: {
        user: UserRecord;
        data: SubscriptionRequestData;
    } 
}

interface SubscriptionRequestData {
    plan: 'personal' | 'business';
}
