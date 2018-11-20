import * as admin from 'firebase-admin';

import * as domainFunctions from './domains/domain';
import * as checkDomainFunctions from './domains/check-domain';
import * as assignDomainFunctions from './domains/assign-domain';

admin.initializeApp();

export const domains = domainFunctions.domain;
export const checkdomain = checkDomainFunctions.checkDomain;
export const assignUserToDomain = assignDomainFunctions.assignDomain;

