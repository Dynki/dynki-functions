import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import * as domainFunctions from './domain';

admin.initializeApp();

export const getUserDomain = domainFunctions.getUserDomain;
export const createUserDomain = domainFunctions.createUserDomain;