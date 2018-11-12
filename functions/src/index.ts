import * as admin from 'firebase-admin';

import * as domainFunctions from './domains/domain';
import * as checkDomainFunctions from './domains/check-domain';

admin.initializeApp();

export const domains = domainFunctions.domain;
export const checkdomain = checkDomainFunctions.checkDomain;

