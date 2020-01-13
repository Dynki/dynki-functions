import * as admin from 'firebase-admin';

import * as inviteFunctions from './domains/invite';
import * as domainFunctions from './domains/domain';
import * as setupIntentsFunctions from './subscriptions/setup-intents';
import * as subscriptionFunctions from './subscriptions/subscription';
import * as paymentMethodsFunctions from './subscriptions/payment-methods';
import * as checkDomainFunctions from './domains/check-domain';
import * as removeDomainFunctions from './domains/remove-domain';

admin.initializeApp();

export const invite = inviteFunctions.invite;
export const domains = domainFunctions.domain;
export const subscriptions = subscriptionFunctions.subscription;
export const paymentMethods = paymentMethodsFunctions.paymentMethods;
export const setupIntents = setupIntentsFunctions.setupIntents;
export const checkdomain = checkDomainFunctions.checkDomain;
export const removeDomain = removeDomainFunctions;
