import { Express, Request, Response, Router } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';
import newGuid from '../utils/guid';

import { DynRestBase } from '../base/restbase';
import { DomainRequest } from '../base/dynki-request';

import roles from './roles-enum';
import { DomainGroups } from './domain-groups';

export class DomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * Groups
         */
        this.setGroupsRouter();
    }

    setGroupsRouter() {
        new DomainGroups(this.domainApp);
    }

    /**
     * Domain methods
     */

    async get(req: DomainRequest, res: Response) {
        try {
            const { user } = req.body.dynki;

            const domainCollection = await admin.firestore()
                .collection('user-domains').where('users', 'array-contains', user.uid).get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const domains = domainCollection.docs.map(d => {
                    return { id: d.id, display_name: d.data().display_name }
                });

                res.json(domains);
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async getId(req: DomainRequest, res: Response, next, id) {
        try {
            const { user } = req.body.dynki;

            const domainCollection = await admin.firestore()
                .collection('user-domains')
                .where(admin.firestore.FieldPath.documentId(), '==', id)
                .where('users', 'array-contains', user.uid)
                .get();

            if (domainCollection && domainCollection.docs.length > 0) {
                const retrievedData = domainCollection.docs[0].data();

                const mappedDomain = {
                    id: domainCollection.docs[0].id,
                    display_name: retrievedData.display_name,
                    status: 'Enabled',
                    groups: retrievedData.groups ? retrievedData.groups : [],
                    members: retrievedData.members ? retrievedData.members : []
                }
                
                // This is the item we will expose in the response.
                req.body.dynki.data.domainRecord = mappedDomain;

                // More for internal use within these functions.
                req.body.dynki.data.domainId = domainCollection.docs[0].id;
                req.body.dynki.data.domainRawRecord = domainCollection.docs[0].data();
                next();
                
            } else {
                res.status(404).send();
            } 
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async returnId(req: Request, res: Response) {
        try {
            res.json(req.body.dynki.data.domainRecord);
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async post(req: DomainRequest, res: Response) {
        try {

            const { displayName, email, name } = req.body;
            const { user } = req.body.dynki;

            const domainRecord = {
                name: newGuid(),
                display_name: name,
                owner: user.uid,
                admins: [user.uid],
                users: [user.uid],
                groups: [
                    { id: roles.Administrators, name: 'Administrators', members: [user.uid] },
                    { id: roles.BoardUsers, name: 'Board Users', members: [user.uid] },
                    { id: roles.BoardCreators, name: 'Board Creators', members: [user.uid] }
                ],
                members: [
                    { 
                        id: newGuid(),
                        uid: user.uid,
                        email: email,
                        status: 'Active',
                        memberOf: [roles.Administrators, roles.BoardUsers, roles.BoardCreators] 
                    }
                ]
            }

            const docRef = await admin.firestore().collection('user-domains').add(domainRecord);
            const doc = await admin.firestore().collection('user-domains').doc(docRef.id).get();
            await admin.firestore().collection('domains').doc(docRef.id).set({display_name: name});
            await admin.firestore().collection('domains').doc(docRef.id).collection('users').doc(user.uid).set({
                email, displayName
            });
            
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
                to: [email],
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

            const domainIds = {
                [docRef.id]: { roles: [roles.Administrators, roles.BoardUsers, roles.BoardCreators] }
            }

            await admin.auth().setCustomUserClaims(
                user.uid, 
                { domainId: docRef.id, domainIds }
            );

            res.json({ id: doc.data().id });
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
