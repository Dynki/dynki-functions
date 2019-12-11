import { UserRecord } from "firebase-functions/lib/providers/auth";
import { Request } from "express";

export interface DomainRequest extends Request {
    body: DomainRequestBody;
}

interface DomainRequestBody {
    displayName: string;
    email: string;
    name: string;
    group_name: string;
    log: any;
    dynki: {
        user: UserRecord;
        data: DomainRequestData;
    } 
}

interface DomainRequestData {
    domainId: string;
    domainRecord: any;
    domainRawRecord: any;
    group: any;
    groupId: string;
}
