import newGuid from '../utils/guid';
import roles from './roles-enum';
import { UserRecord } from 'firebase-functions/lib/providers/auth';

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// When a user is created, register them with Stripe
export const createUserDomain = functions.auth.user().onCreate(async (user: UserRecord) => {
    const domainRecord = {
        name: newGuid(),
        display_name: 'Your Team',
        owner: user.uid,
        admins: [user.uid],
        users: [user.uid],
        groups: [
            { id: roles.Administrators, name: roles.Administrators, members: [user.uid] },
            { id: roles.BoardUsers, name: roles.BoardUsers, members: [user.uid] },
            { id: roles.BoardCreators, name: roles.BoardCreators, members: [user.uid] }
        ],
        members: [
            { 
                id: newGuid(),
                uid: user.uid,
                email: user.email,
                status: 'Active',
                memberOf: [roles.Administrators, roles.BoardUsers, roles.BoardCreators] 
            }
        ]
    }

    const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
    admin.firestore().collection('domains').doc(docRef.id).collection('users').doc(user.uid).set({
        email: user.email
    });

    const domainIds = {
        [docRef.id]: { roles: [roles.Administrators, roles.BoardUsers, roles.BoardCreators] }
    }

    await admin.firestore()
    .collection('domains')
    .doc(docRef.id)
    .collection('users')
    .doc(user.uid)
    .collection('messages')
    .doc('initial')
    .set({
        id: 'initial',
        from: 'Dynki Team',
        to: [user.email],
        subject: 'Welcome to Dynki',
        body: {
            ops: [
            { insert: 'Hi, \n\n' +
            'Thanks for choosing to give us a try. \n' +
            'You can now start creating boards. \n\n' +
            'Once again thanks for choosing us. \n\n' +
            'Regards \n' },
            { insert: 'Team Dynki', attributes: { bold: true } }
        ]},
        sent: true,
        created: new Date(),
        author: 'Dynki Team',
        status: 'Unread',
        read: false,
        reading: false,
        selected: false
    });

    return admin.auth().setCustomUserClaims(
        user.uid, 
        { domainId: docRef.id, domainIds }
    );
});
