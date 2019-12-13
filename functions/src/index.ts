import * as admin from 'firebase-admin';

import * as inviteFunctions from './domains/invite';
import * as domainFunctions from './domains/domain';
import * as checkDomainFunctions from './domains/check-domain';
import * as removeDomainFunctions from './domains/remove-domain';
import { createStripeCustomer } from './auth/createStripeCustomer';

admin.initializeApp();

export const invite = inviteFunctions.invite;
export const domains = domainFunctions.domain;
export const checkdomain = checkDomainFunctions.checkDomain;
export const removeDomain = removeDomainFunctions;
export const createSubscriptionCustomer = createStripeCustomer;
