import * as admin from 'firebase-admin';

import * as domainFunctions from './domains/domain';

admin.initializeApp();

export const domains = domainFunctions.domain;

