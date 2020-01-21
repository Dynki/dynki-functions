import { Express, Request, Response } from 'express';
import * as admin from 'firebase-admin'; 
import * as _ from 'lodash';
import newGuid from '../utils/guid';

import { DynRestBase } from '../base/restbase';
import { DomainRequest } from '../base/dynki-request';

import roles from './roles-enum';
import { DomainGroups } from './domain-groups';
import { DomainMembers } from './domain-members';

export class DomainRest extends DynRestBase {
    constructor(public domainApp: Express) {
        super(domainApp);

        /**
         * Groups
         */
        this.setGroupsRouter();

        /**
         * Members
         */
        this.setMembersRouter();
    }

    setGroupsRouter() {
        new DomainGroups(this.domainApp);
    }

    setMembersRouter() {
        new DomainMembers(this.domainApp);
    }

    private isAdmin = (req: DomainRequest, domainId: string) : boolean => {

        // How to check if someone is an admin?

        // First we need to obtain the user's custom claims. 
        // This can be accessed from the req.body.dynki.user.customClaims object
        
        // Within the custom claims is the domainIds object. Each key in the object is the id of a domain.
        // The value part of each domain is an object containing roles.
        // E.g. domainIds: { rtJT7LAZP4HLrBbNWo1T: { roles: ["ADMINISTRATORS", "BOARD_USERS", "BOARD_CREATORS"] } }

        // We now just need to check if the user has the "ADMINISTRATORS" role for the domain ID we are
        // currently dealing with. The domain ID should already have been populated (via Express routing)
        // and should be on the req.body.dynki.data.domainId property.

        const { customClaims } = <any>req.body.dynki.user;

        if (!customClaims.domainIds || !customClaims.domainIds[domainId] || !customClaims.domainIds[domainId].roles) {
            return false;
        }

        return customClaims.domainIds[domainId].roles.includes(roles.Administrators);
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
                .where('users', 'array-contains' , user.uid)
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
                    { id: roles.Administrators, name: roles.Administrators, members: [user.uid] },
                    { id: roles.BoardUsers, name: roles.BoardUsers, members: [user.uid] },
                    { id: roles.BoardCreators, name: roles.BoardCreators, members: [user.uid] }
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

            await admin.firestore().collection('user-domains').doc(user.uid).set(domainRecord);
            await admin.firestore().collection('domains').doc(user.uid).set({ display_name: name, status: 'inactive' });
            await admin.firestore().collection('domains').doc(user.uid).collection('users').doc(user.uid).set({
                email, displayName
            });
            
            await admin.firestore()
            .collection('domains')
            .doc(user.uid)
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
                [user.uid]: { roles: [roles.Administrators, roles.BoardUsers, roles.BoardCreators] }
            }

            await admin.auth().setCustomUserClaims(
                user.uid, 
                { domainId: user.uid, domainIds }
            );

            res.json({ id: user.uid });
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }

    async put(req: DomainRequest, res: Response) {
        try {

            const { name } = req.body;
            const { user } = req.body.dynki;
            const { domainId } = req.body.dynki.data;

            // Check if user is owner of the domain.
            const domainCollection = await admin.firestore()
            .collection('user-domains')
            .where('owner', '==', user.uid)
            .get();
                        
            console.log('Domain collection docs length', domainCollection.docs.length);

            if (domainCollection && domainCollection.docs.length > 0) {
                const userDomains = domainCollection.docs[0].data();
                
                console.log('UserDomains Data', userDomains);

                if (userDomains.owner === user.uid || this.isAdmin(req, domainId)) {
                    await admin.firestore().collection('user-domains').doc(domainId).update({display_name: name});
                    await admin.firestore().collection('domains').doc(domainId).update({display_name: name});
                } else {
                    res.status(401).send('Unauthorised to perform this operation - not the owner/admin');
                }
            } else {
                res.status(401).send('Unauthorised to perform this operation - domain not located');
            }
    
            res.status(200).send();
        } catch (error) {
            console.log(error);
            res.status(500).send({ error });
        }
    }
}
